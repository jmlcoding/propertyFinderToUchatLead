const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const client = new Client({
    authStrategy: new LocalAuth()
});

// Generate QR code for login if not logged in
client.on('qr', qr => {
    console.log(qr);
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code to log in.');
});
// Once logged in
client.on('ready', () => {
    console.log('Client is ready!');
});
// Handling received messages
client.on("message", async (message) => {
    if (message.from === "97444627879@c.us") {
      // Extract first link
      const links = message.links?.map((linkObj) => linkObj.link) || [];
  
      if (links.length > 0) {
        console.log(`Extracted Original Link: ${links[0]}`);
  
        // Determine if the message body contains Arabic or English reference number
        let referenceNumberMatch;
        let isArabic = false;
  
        if (message.body.includes("الرقم المرجعي")) {
          referenceNumberMatch = message.body.match(/الرقم المرجعي\s*:\s*(\S+)/);
          isArabic = true;
        } else {
          referenceNumberMatch = message.body.match(/\*Reference number:\* (\S+)/);
        }
  
        const referenceNumber = referenceNumberMatch ? referenceNumberMatch[1] : "No reference number found";
  
        // Print extracted information
        console.log(`Extracted Links: ${links.join(", ")}`);
        console.log(`Extracted Reference Number: ${referenceNumber}`);
        console.log(`Message Language is Arabic: ${isArabic}`);
        const PhoneNumber = await extractPhoneNumber(await getFinalUrl(links[0]));
        console.log(`Extracted Phone Number: ${PhoneNumber}`);
        await delay(4000); 
        // await sendToUChat(PhoneNumber, referenceNumber, isArabic);
        // console.log(`Message sent to UChat with Phone Number: ${PhoneNumber}, Reference Number: ${referenceNumber}, Language: ${isArabic}`);
      } else {
        console.log("No links found.");
      }
    } else {
      console.log("Message not from the specified number: " + message.from);
    }
  });
async function getFinalUrl(originalUrl) {
    try {
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'PostmanRuntime/7.31.1',  // Simulate Postman
                'Accept': '*/*',
                'Connection': 'keep-alive'
            },
            maxRedirects: 10
        });
        console.log(`Final URL: ${response.request.res.responseUrl}`);
        return response.request.res.responseUrl;
        
    } catch (error) {
        console.error(`Error following redirect: ${error.message}`);
        return originalUrl;
    }
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractPhoneNumber(url) {
    const match = url.match(/phone=(\d+)/);
    return match ? match[1] : "No phone number found";
}

async function sendToUChat(phoneNumber, referenceNumber, isArabic) {
    const jsonBody = {
        property_finder_user_number: phoneNumber,
        property_finder_reference_number: referenceNumber,
        property_finder_name: "property finder lead", // Replace with your actual message
        property_finder_message_language: isArabic
    };

    try {
        const response = await axios.post(
            "https://www.uchat.com.au/api/iwh/c3cf17ee3628fbedf3debc22cc4c053d", // Replace with UChat API URL
            jsonBody,
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Response from UChat:", response.data);
    } catch (error) {
        console.error("Failed to send message to UChat:", error);
    }
}
client.initialize();