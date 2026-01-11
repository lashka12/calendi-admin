import axios from "axios";

/**
 * Send WhatsApp message via UltraMsg
 * @param to - Phone number (e.g., "050-1234567" or "+972501234567")
 * @param message - Message text (supports emojis and formatting)
 * @returns Response from UltraMsg
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<any> {
  // 🔧 EMULATOR MODE: Mock WhatsApp sending during local development
  if (process.env.FUNCTIONS_EMULATOR) {
    console.log("🔧 [EMULATOR] Mocking WhatsApp send (not sending real message)");
    console.log("   📱 To:", to);
    console.log("   📝 Message:");
    console.log("   ┌─────────────────────────────────────────────────┐");
    message.split("\n").forEach((line) => {
      console.log(`   │ ${line.padEnd(47)} │`);
    });
    console.log("   └─────────────────────────────────────────────────┘");
    console.log("✅ [EMULATOR] WhatsApp mocked successfully");

    // Return mock response
    return {
      id: `emulator-msg-${Date.now()}`,
      status: "sent",
      emulator: true,
    };
  }

  // 🌐 PRODUCTION MODE: Send real WhatsApp message
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;

  if (!instanceId || !token) {
    console.error("❌ UltraMsg credentials not configured");
    throw new Error("UltraMsg not configured");
  }

  // Format phone: remove +, -, and spaces
  // Example: +972-50-1234567 → 972501234567
  const cleanPhone = to.replace(/[+\-\s]/g, "");

  console.log("📱 Sending WhatsApp...");
  console.log("   Original phone:", to);
  console.log("   Cleaned phone:", cleanPhone);

  try {
    const response = await axios.post(
      `https://api.ultramsg.com/${instanceId}/messages/chat`,
      {
        token: token,
        to: cleanPhone,
        body: message,
        priority: 10,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("✅ WhatsApp sent successfully");
    console.log("   Response:", response.data);

    return response.data;
  } catch (error: any) {
    console.error("❌ WhatsApp send failed");
    const errorData = error.response && error.response.data
      ? error.response.data
      : error.message;
    console.error("   Error:", errorData);
    throw error;
  }
}

