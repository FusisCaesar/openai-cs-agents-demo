// Helper to call the server
export async function callChatAPI(message: string, conversationId: string, triageName?: string) {
  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, message, triage_name: triageName }),
    });
    if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
    return res.json();
  } catch (err) {
    console.error("Error sending message:", err);
    return null;
  }
}
