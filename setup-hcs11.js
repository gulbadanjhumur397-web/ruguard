require('dotenv').config();
const sdk = require('@hashgraphonline/standards-sdk');

async function main() {
    console.log("Setting up HCS-11 Profile for account:", process.env.HEDERA_ACCOUNT_ID);
    const client = new sdk.HCS11Client({
        network: 'testnet',
        auth: {
            operatorId: process.env.HEDERA_ACCOUNT_ID,
            privateKey: process.env.HEDERA_PRIVATE_KEY
        }
    });

    // Create the profile locally
    const profile = client.createAIAgentProfile(
        "RugGuard", 
        sdk.AIAgentType.AUTONOMOUS, 
        [sdk.AIAgentCapability.SECURITY_MONITORING], 
        "GPT-4o", 
        {
            bio: "Autonomous AI Agent for scanning Hedera tokens for vulnerabilities and rug pulls.",
            creator: process.env.HEDERA_ACCOUNT_ID,
            baseAccount: process.env.HEDERA_ACCOUNT_ID
        }
    );

    console.log("Profile object created, inscribing to Hedera and updating memo...");
    
    // Inscribe and update the account memo
    const result = await client.createAndInscribeProfile(profile, true);
    
    console.log("Successfully inscribed HCS-11 Profile!");
    console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
