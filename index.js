const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log(qr);
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code to log in.');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

// Initialize static counters
let propertyFinderLeadCounter = 0;
let qatarLivingCounter = 0;

client.on("message", async (message) => {
    const currentDateTime = new Date().toISOString(); // Get current date and time in ISO format

    if (message.from === "97444627879@c.us") {
        propertyFinderLeadCounter++; 
        console.log(`Property Finder Lead Counter: ${propertyFinderLeadCounter}`);

        const links = message.links?.map((linkObj) => linkObj.link) || [];
  
        if (links.length > 0) {
            let referenceNumberMatch;
            let isArabic = false;
            if (message.body.includes("الرقم المرجعي")) {
                referenceNumberMatch = message.body.match(/الرقم المرجعي\s*:\s*(\S+)/);
                isArabic = true;
            } else {
                referenceNumberMatch = message.body.match(/\*Reference number:\* (\S+)/);
            }
            const referenceNumber = referenceNumberMatch ? referenceNumberMatch[1] : "No reference number found";
            const PhoneNumber = await extractPhoneNumber(await getFinalUrl(links[0]));
            console.log(`Extracted Phone Number: ${PhoneNumber} ref: ${referenceNumber} language ar ?: ${isArabic}`);
            console.log(`Date and Time: ${currentDateTime}`);

            // Add data to Excel
            await addToExcel(PhoneNumber, referenceNumber, "Property Finder", currentDateTime);
		await delay(4000); 
            await sendToUChatPropertyFinder(PhoneNumber, referenceNumber, isArabic); 
        } else {
            console.log("No links found.");
        }
    } else if (message.from === "97433888435@c.us") {
        qatarLivingCounter++; 
        console.log(`Qatar Living Counter: ${qatarLivingCounter}`);

        const links = message.links?.map((linkObj) => linkObj.link) || [];
    
        if (links.length > 1) {
            const propertyLink = links[0];
            const leadIdMatch = links[1].match(/url=([^&]+)/);
            const leadId = leadIdMatch ? leadIdMatch[1] : "No lead ID found";
            console.log(`Property Link: ${propertyLink}`);
            console.log(`Lead ID: ${leadId}`);
            console.log(`Date and Time: ${currentDateTime}`);

            const response = await sendPostRequestToServerQatarLiving(leadId, propertyLink);

            // Add data to Excel
            await addToExcel(response, leadId, "Qatar Living", currentDateTime);
		await delay(4000); 
            await sendToUChatQatarLiving(response, propertyLink, false);
            

        } else {
            console.log("Insufficient links to extract property link and lead ID.");
        }
    } else {
        console.log("Message not from the specified number: " + message.from);
        console.log(`Date and Time: ${currentDateTime}`);
    }
});
async function getFinalUrl(originalUrl) {
    try {
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'PostmanRuntime/7.31.1',  
                'Accept': '*/*',
                'Connection': 'keep-alive'
            },
            maxRedirects: 10
        });
 
        const finalUrl = response.request.res?.responseUrl || originalUrl;
        console.log(`Final URL: ${finalUrl}`);
        return finalUrl;
        
    } catch (error) {
        console.error(`Error following redirect: ${error.message}`);
        return originalUrl;
    }
}
function refactoringQatarLivingLink(originalLink) {
    try {
        // Extract the path after the domain
        const urlPath = originalLink.split(".com")[1];
        if (!urlPath) {
            throw new Error("Invalid link format");
        }

        // Encode the path for the new format
        const encodedPath = encodeURIComponent(urlPath);

        // Construct the new link
        const newLink = `https://qlp-bo-prod.qatarliving.com/properties/id?id=${encodedPath}`;
        return newLink;
    } catch (error) {
        console.error("Error refactoring Qatar Living link:", error.message);
        return null;
    }
}
async function sendPostRequestToServerQatarLiving(qatarLivingLeadId, qatarLivingPropertyUrl) {
    const jsonBody = {
        _token: "0BOZCEURICzQg7DkvJJZCStoxt", // Add your token here
        qatar_living_lead_id: qatarLivingLeadId // Add the lead ID
    };

    try {
        const response = await axios.post(
            "https://stepsinvestor.com/qatar-living-get-number", // Replace with your actual server URL
            jsonBody,
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Response from server:", response.data.phone_number);
        return response.data.phone_number; // Return the server response
    } catch (error) {
        console.error("Failed to send POST request:", error.message);
    }
}
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function extractPhoneNumber(url) {
    const match = url.match(/phone=(\d+)/);
    return match ? match[1] : "No phone number found";
}
async function sendToUChatPropertyFinder(phoneNumber, referenceNumber, isArabic) {
    const jsonBody = {
        property_finder_user_number: phoneNumber,
        property_finder_reference_number: referenceNumber,
        property_finder_name: source, 
        property_finder_message_language: isArabic
    };
 await sendToUChat( jsonBody,isArabic,"https://www.uchat.com.au/api/iwh/c3cf17ee3628fbedf3debc22cc4c053d");
}
async function sendToUChatQatarLiving(phoneNumber, referenceNumber, isArabic) {

        const jsonBody = {
        qatar_living_user_number: phoneNumber,
        qatar_living_property_url: referenceNumber,
        qatar_living_modified_url: source, 
        qatar_living_name: source
    };
    await sendToUChat( jsonBody,"https://www.uchat.com.au/api/iwh/715d26e9dcde03c53bc046eb99e3b1c8");
}
async function sendToUChat(data,link) {
    try {
        const response = await axios.post(
            link, // Replace with UChat API URL
            data,
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

const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

async function addToExcel(phoneNumber, referenceNumber, source, currentDate) {
    try {
        const filePath = path.join(__dirname, 'leads.xlsx');

        let workbook;
        let worksheet;

        // Check if the Excel file already exists
        if (fs.existsSync(filePath)) {
            workbook = xlsx.readFile(filePath);
            worksheet = workbook.Sheets['Leads'] || xlsx.utils.aoa_to_sheet([]);
        } else {
            workbook = xlsx.utils.book_new();
            worksheet = xlsx.utils.aoa_to_sheet([['Seq', 'Phone Number', 'Reference Number', 'Source', 'Date']]); // Add headers
        }

        // Convert worksheet to JSON to calculate the sequence
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // Calculate the next sequence number
        const nextSeq = data.length;

        // Add the new row
        data.push([nextSeq, phoneNumber, referenceNumber || 'N/A', source, currentDate]);

        // Convert JSON back to worksheet and save
        const newWorksheet = xlsx.utils.aoa_to_sheet(data);
        workbook.Sheets['Leads'] = newWorksheet;
        if (!workbook.SheetNames.includes('Leads')) {
            xlsx.utils.book_append_sheet(workbook, newWorksheet, 'Leads');
        }
        xlsx.writeFile(workbook, filePath);

        console.log('Data successfully added to Excel file.');
    } catch (error) {
        console.error('Error adding data to Excel:', error.message);
    }
}

// Example usage
// await addToExcel('1234567890', 'REF123', 'Qatar Living');
client.initialize();