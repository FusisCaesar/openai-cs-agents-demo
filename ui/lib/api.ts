// Helper to call the server
export async function callChatAPI(message: string, conversationId: string, triageName?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, message, triage_name: triageName }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("Chat API error status:", res.status);
      return null;
    }
    return res.json();
  } catch (err) {
    console.error("Error sending message:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
