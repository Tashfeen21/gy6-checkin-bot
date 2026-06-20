import type { Env } from "./slack"

const NOTION_VERSION = "2022-06-28"

export type AttendanceAction =
	| "Check in"
	| "Break start"
	| "Break end"
	| "Meeting"
	| "Check out"

// Create one row in the Notion Attendance Log database.
export async function logAttendance(
	env: Env,
	args: {
		employeeName: string
		slackUserId: string
		action: AttendanceAction
		timestampIso: string
		localTime: string
	},
): Promise<void> {
	const body = {
		parent: { database_id: env.NOTION_ATTENDANCE_DB_ID },
		properties: {
			Entry: {
				title: [
					{
						text: {
							content: `${args.employeeName} - ${args.action} - ${args.localTime}`,
						},
					},
				],
			},
			"Employee Name": {
				rich_text: [{ text: { content: args.employeeName } }],
			},
			"Slack User ID": {
				rich_text: [{ text: { content: args.slackUserId } }],
			},
			Action: { select: { name: args.action } },
			Timestamp: { date: { start: args.timestampIso } },
			"Local Time": {
				rich_text: [{ text: { content: args.localTime } }],
			},
		},
	}

	const res = await fetch("https://api.notion.com/v1/pages", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.NOTION_TOKEN}`,
			"Content-Type": "application/json",
			"Notion-Version": NOTION_VERSION,
		},
		body: JSON.stringify(body),
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Notion API error ${res.status}: ${text}`)
	}
}
