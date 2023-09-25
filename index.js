// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// index.js is used to setup and configure your bot

// Import required pckages
const path = require('path');

// Read botFilePath and botFileSecret from .env file.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

const restify = require('restify');
const { env } = require('process');
// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { UserState, MemoryStorage, CloudAdapter, ConfigurationBotFrameworkAuthentication } = require('botbuilder');
const { TeamsMessagingExtensionsSearchAuthConfigBot } = require('./bot2/teamsMessagingExtensionsSearchAuthConfigBot');

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(process.env);

var conname = env.connectionName;

console.log(`\n${conname} is the con name`);

// Create adapter.
// See https://learn.microsoft.com/en-us/azure/bot-service/bot-builder-basics?view=azure-bot-service-4.0 to learn more about how bots work.
const adapter = new CloudAdapter(botFrameworkAuthentication);
const memoryStorage1 = new MemoryStorage();

adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights. See https://aka.ms/bottelemetry for telemetry 
    //       configuration instructions.
    console.error(`\n [onTurnError] unhandled error: ${error}`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${error}`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Uncomment below commented line for local debugging.
    // await context.sendActivity(`Sorry, it looks like something went wrong. Exception Caught: ${error}`);

    // Note: Since this Messaging Extension does not have the messageTeamMembers permission
    // in the manifest, the bot will not be allowed to message users.
};

// Define a state store for your bot. See https://aka.ms/about-bot-state to learn more about using MemoryStorage.
// A bot requires a state store to persist the dialog and user state between messages.

// For local development, in-memory storage is used.
// CAUTION: The Memory Storage used here is for local bot debugging only. When the bot
// is restarted, anything stored in memory will be gone.
// const memoryStorage = new MemoryStorage();
const userState = new UserState(memoryStorage1);

// Create the bot that will handle incoming messages.
const bot = new TeamsMessagingExtensionsSearchAuthConfigBot(userState);

// Create HTTP server.
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`\n${server.name} listening to ${server.url}`);
});

// Listen for incoming requests.
server.post('/api/messages', async (req, res) => {
    await adapter
        .process(req, res, async (context) => {
            await bot.run(context);
        })
        .catch((err) => {
            // Error message including "412" means it is waiting for user's consent, which is a normal process of SSO, sholdn't throw this error.
            if (!err.message.includes("412")) {
                throw err;
            }
        });
});