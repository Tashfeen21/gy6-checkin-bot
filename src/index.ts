import {
	Env,
	verifySlackSignature,
	slackApi,
	getUserProfile,
} from "./slack"
import { logAttendance, AttendanceAction } from "./notion"

// Button action_ids (App Home) -> attendance action.
const BUTTON_MAP: Record<string, AttendanceAction> = {
	checkin: "Check in",
	break_start: "Break start",
	break_end: "Break end",
	meeting: "Meeting",
	checkout: "Check out",
}

// Slash commands (without the leading slash) -> attendance action.
const COMMAND_MAP: Record<string, AttendanceAction> = {
	checkin: "Check in",
	break: "Break start",
	back: "Break end",
	meeting: "Meeting",
	checkout: "Check out",
}

function formatLocalTime(date: Date, tz: string): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		weekday: "short",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date)
}

// The App Home dashboard with action buttons.
function homeView() {
	const button = (
		text: string,
		actionId: string,
		style?: "primary" | "danger",
	) => ({
		type: "button",
		text: { type: "plain_text", text, emoji: true },
		action_id: actionId,
		...(style ? { style } : {}),
	})

	return {
		type: "home",
		blocks: [
			{
				type: "header",
				text: { type: "plain_text", text: "GY6 Attendance", emoji: true },
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "Log your work day with the buttons below. Everything is saved to our Notion attendance log.",
				},
			},
			{ type: "divider" },
			{
				type: "actions",
				elements: [
					button("✅ Check In", "checkin", "primary"),
					button("☕ Take Break", "break_start"),
					button("🔙 Back", "break_end"),
					button("📞 In Meeting", "meeting"),
					button("🏁 Check Out", "checkout", "danger"),
				],
			},
		],
	}
}

// Look up the user, timestamp the action, and write it to Notion.
async function recordAction(
	env: Env,
	userId: string,
	action: AttendanceAction,
): Promise<string> {
	const { name, tz } = await getUserProfile(env, userId)
	const now = new Date()
	const localTime = formatLocalTime(now, tz)
	await logAttendance(env, {
		employeeName: name,
		slackUserId: userId,
		action,
		timestampIso: now.toISOString(),
		localTime,
	})
	return `*${action}* logged at *${localTime}* ✅`
}

export default {
	async fetch(
		req: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		if (req.method !== "POST") {
			return new Response("GY6 Check-in bot is running.", { status: 200 })
		}

		const rawBody = await req.text()
		const contentType = req.headers.get("content-type") || ""

		// Security: confirm the request was signed by Slack.
		const valid = await verifySlackSignature(
			req,
			rawBody,
			env.SLACK_SIGNING_SECRET,
		)
		if (!valid) return new Response("invalid signature", { status: 401 })

		// (1) Slash commands and button clicks arrive form-encoded.
		if (contentType.includes("application/x-www-form-urlencoded")) {
			const params = new URLSearchParams(rawBody)

			// Button clicks (interactivity) come as a `payload` JSON string.
			const payloadRaw = params.get("payload")
			if (payloadRaw) {
				const payload = JSON.parse(payloadRaw)
				const userId: string | undefined = payload?.user?.id
				const actionId: string | undefined =
					payload?.actions?.[0]?.action_id
				const action = actionId ? BUTTON_MAP[actionId] : undefined

				if (action && userId) {
					// Do the work after responding so Slack always gets a fast 200.
					ctx.waitUntil(
						(async () => {
							const msg = await recordAction(env, userId, action)
							if (payload.response_url) {
								await fetch(payload.response_url, {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										response_type: "ephemeral",
									text: msg,
								}),
								})
							}
						})(),
					)
				}
				return new Response("", { status: 200 })
			}

			// Slash commands.
			const command = params.get("command")
			const userId = params.get("user_id")
			if (command && userId) {
				const key = command.replace(/^\//, "")
				const action = COMMAND_MAP[key]
				if (!action) {
					return Response.json({
						response_type: "ephemeral",
						text: `Unknown command: ${command}`,
					})
				}
				const msg = await recordAction(env, userId, action)
				return Response.json({ response_type: "ephemeral", text: msg })
			}

			return new Response("ok", { status: 200 })
		}

		// (2) Events API (JSON body).
		let body: any
		try {
			body = JSON.parse(rawBody)
		} catch {
			return new Response("ok", { status: 200 })
		}

		// Slack's one-time URL verification handshake.
		if (body.type === "url_verification") {
			return Response.json({ challenge: body.challenge })
		}

		if (
			body.type === "event_callback" &&
			body.event?.type === "app_home_opened"
		) {
			ctx.waitUntil(
				slackApi(env, "views.publish", {
					user_id: body.event.user,
					view: homeView(),
				}),
			)
			return new Response("", { status: 200 })
		}

		return new Response("ok", { status: 200 })
	},
}
