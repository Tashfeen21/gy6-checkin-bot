// Slack helpers for Cloudflare Workers (uses only Web-standard APIs).

export interface Env {
	SLACK_SIGNING_SECRET: string
	SLACK_BOT_TOKEN: string
	NOTION_TOKEN: string
	NOTION_ATTENDANCE_DB_ID: string
	TZ_DEFAULT?: string
}

// Verify the request truly came from Slack using the app's signing secret.
export async function verifySlackSignature(
	req: Request,
	rawBody: string,
	signingSecret: string,
): Promise<boolean> {
	const timestamp = req.headers.get("x-slack-request-timestamp")
	const signature = req.headers.get("x-slack-signature")
	if (!timestamp || !signature) return false

	// Reject requests older than 5 minutes (replay-attack protection).
	if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false

	const basestring = `v0:${timestamp}:${rawBody}`
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(signingSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	)
	const sigBuffer = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(basestring),
	)
	const computed =
		"v0=" +
		[...new Uint8Array(sigBuffer)]
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
	return computed.length === signature.length && computed === signature
}

// Call any Slack Web API method with the bot token.
export async function slackApi(
	env: Env,
	method: string,
	payload: Record<string, unknown>,
): Promise<any> {
	const res = await fetch(`https://slack.com/api/${method}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
		},
		body: JSON.stringify(payload),
	})
	return res.json()
}

// Look up a user's display name and timezone.
export async function getUserProfile(env: Env, userId: string) {
	const data = await slackApi(env, "users.info", { user: userId })
	const tz: string = data?.user?.tz || env.TZ_DEFAULT || "UTC"
	const name: string =
		data?.user?.profile?.real_name || data?.user?.name || userId
	return { name, tz }
}
