// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const {
    TeamsActivityHandler,
    CardFactory,
    ActionTypes,
    ActivityHandler
} = require('botbuilder');

const {
    ExtendedUserTokenProvider
} = require('botbuilder-core')

const axios = require('axios');
const querystring = require('querystring');
const { SimpleGraphClient } = require('..\\simpleGraphClient.js');
const { polyfills } = require('isomorphic-fetch');
const { executionWithOauthConnect } = require('../sdk/executeMessageExtension.js')

// User Configuration property name
const USER_CONFIGURATION = 'userConfigurationProperty';

class TeamsMessagingExtensionsSearchAuthConfigBot extends TeamsActivityHandler {
    /**
     *
     * @param {UserState} User state to persist configuration settings
     */
    constructor(userState) {
        super();
        // Creates a new user property accessor.
        // See https://aka.ms/about-bot-state-accessors to learn more about the bot state and state accessors.
        this.userConfigurationProperty = userState.createProperty(
            USER_CONFIGURATION
        );
        this.connectionName = process.env.ConnectionName;
        this.userState = userState;
    }

    /**
     * Override the ActivityHandler.run() method to save state changes after the bot logic completes.
     */
    async run(context) {
        await super.run(context);

        // Save state changes
        await this.userState.saveChanges(context);
    }

    // Overloaded function. Receives invoke activities with Activity name of 'composeExtension/queryLink'
    async handleTeamsAppBasedLinkQuery(context, query) {
        return await executionWithOauthConnect(context, process.env.connectionName, query, async (token) => {
            const graphClient = new SimpleGraphClient(token);
            const profile = await graphClient.GetMyProfile();
            const userPhoto = await graphClient.GetPhotoAsync(token);
            const attachment = CardFactory.thumbnailCard(profile.displayName, CardFactory.images([userPhoto]));
            const result = {
                attachmentLayout: 'list',
                type: 'result',
                attachments: [attachment]
            };

            const response = {
                composeExtension: result
            };

            return response;
        });
    }
    async handleTeamsMessagingExtensionConfigurationQuerySettingUrl(
        context,
        query
    ) {
        // The user has requested the Messaging Extension Configuration page settings url.
        const userSettings = await this.userConfigurationProperty.get(
            context,
            ''
        );
        const escapedSettings = userSettings
            ? querystring.escape(userSettings)
            : '';

        return {
            composeExtension: {
                type: 'config',
                suggestedActions: {
                    actions: [
                        {
                            type: ActionTypes.OpenUrl,
                            value: `${process.env.SiteUrl}/public/searchSettings.html?settings=${escapedSettings}`
                        },
                    ],
                },
            },
        };
    }

    // Overloaded function. Receives invoke activities with the name 'composeExtension/setting
    async handleTeamsMessagingExtensionConfigurationSetting(context, settings) {
        // When the user submits the settings page, this event is fired.
        if (settings.state != null) {
            await this.userConfigurationProperty.set(context, settings.state);
        }
    }

    // Overloaded function. Receives invoke activities with the name 'composeExtension/query'.
    async handleTeamsMessagingExtensionQuery(context, query) {
        const searchQuery = query.parameters[0].value;
        const attachments = [];
        const userSettings = await this.userConfigurationProperty.get(
            context,
            ''
        );
        if (!userSettings || userSettings.includes('profile')) {
            return await executionWithOauthConnect(context, process.env.connectionName, query, async (token) => {
                const graphClient = new SimpleGraphClient(token);
                const profile = await graphClient.GetMyProfile();
                const userPhoto = await graphClient.GetPhotoAsync(token);
                const thumbnailCard = CardFactory.thumbnailCard(profile.displayName, CardFactory.images([userPhoto]));
                attachments.push(thumbnailCard);
                return {
                    composeExtension: {
                        type: 'result',
                        attachmentLayout: 'list',
                        attachments: attachments
                    },
                };
            });
        } else {
            const response = await axios.get(
                `http://registry.npmjs.com/-/v1/search?${querystring.stringify({
                    text: searchQuery,
                    size: 8
                })}`
            );

            response.data.objects.forEach((obj) => {
                const heroCard = CardFactory.heroCard(obj.package.name);
                const preview = CardFactory.heroCard(obj.package.name);
                preview.content.tap = {
                    type: 'invoke',
                    value: { description: obj.package.description }
                };
                attachments.push({ ...heroCard, preview });
            });
        }

        return {
            composeExtension: {
                type: 'result',
                attachmentLayout: 'list',
                attachments: attachments
            },
        };
    }

    // Overloaded function. Receives invoke activities with the name 'composeExtension/selectItem'.
    async handleTeamsMessagingExtensionSelectItem(context, obj) {
        console.log('------------------------ handleTeamsMessagingExtensionSelectItem')
        return {
            composeExtension: {
                type: 'result',
                attachmentLayout: 'list',
                attachments: [CardFactory.thumbnailCard(obj.description)]
            },
        };
    }

    // Overloaded function. Receives invoke activities with the name 'composeExtension/fetchTask'
    async handleTeamsMessagingExtensionFetchTask(context, action) {
        console.log('------------------------- handleTeamsMessagingExtensionFetchTask')
        if (action.commandId === 'SHOWPROFILE') {
            const magicCode =
                action.state && Number.isInteger(Number(action.state))
                    ? action.state
                    : '';
            const tokenResponse = await context.adapter.getUserToken(
                context,
                this.connectionName,
                magicCode
            );

            if (!tokenResponse || !tokenResponse.token) {
                // There is no token, so the user has not signed in yet.
                // Retrieve the OAuth Sign in Link to use in the MessagingExtensionResult Suggested Actions

                const signInLink = await context.adapter.getSignInLink(
                    context,
                    this.connectionName
                );

                return {
                    composeExtension: {
                        type: 'silentAuth',
                        suggestedActions: {
                            actions: [
                                {
                                    type: 'openUrl',
                                    value: signInLink,
                                    title: 'Bot Service OAuth'
                                },
                            ],
                        },
                    },
                };
            }

            const graphClient = new SimpleGraphClient(tokenResponse.token);
            const profile = await graphClient.GetMyProfile();
            const userPhoto = await graphClient.GetPhotoAsync(tokenResponse.token);
            const profileCard = CardFactory.adaptiveCard({
                version: '1.0.0',
                type: 'AdaptiveCard',
                body: [
                    {
                        type: 'TextBlock',
                        text: 'Hello: ' + profile.displayName,
                    },
                    {
                        type: 'Image',
                        url: userPhoto,
                    },
                ],
            });
            return {
                task: {
                    type: 'continue',
                    value: {
                        card: profileCard,
                        heigth: 250,
                        width: 400,
                        title: 'Show Profile Card'
                    },
                },
            };
        }
        if (action.commandId === 'SignOutCommand') {
            const adapter = context.adapter;
            await adapter.signOutUser(context, this.connectionName);

            const card = CardFactory.adaptiveCard({
                version: '1.0.0',
                type: 'AdaptiveCard',
                body: [
                    {
                        type: 'TextBlock',
                        text: 'You have been signed out.'
                    },
                ],
                actions: [
                    {
                        type: 'Action.Submit',
                        title: 'Close',
                        data: {
                            key: 'close'
                        },
                    },
                ],
            });

            return {
                task: {
                    type: 'continue',
                    value: {
                        card: card,
                        heigth: 200,
                        width: 400,
                        title: 'Adaptive Card: Inputs'
                    },
                },
            };
        }

        return null;
    }

    async handleTeamsMessagingExtensionSubmitAction(context, action) {
        // This method is to handle the 'Close' button on the confirmation Task Module after the user signs out.
        return {};
    }

    async tokenIsExchangeable(context) {
        let tokenExchangeResponse = null;
        try {
            const valueObj = context.activity.value;
            const tokenExchangeRequest = valueObj.authentication;
            const userTokenClient = context.turnState.get(context.adapter.UserTokenClientKey);
            tokenExchangeResponse = await userTokenClient.exchangeToken(context.activity.from.id,
                process.env.connectionName,
                context.activity.channelId,
                { token: tokenExchangeRequest.token });
            console.log('tokenExchangeResponse: ' + JSON.stringify(tokenExchangeResponse));
        } catch (err) {
            console.log('tokenExchange error: ' + err);
            // Ignore Exceptions
            // If token exchange failed for any reason, tokenExchangeResponse above stays null , and hence we send back a failure invoke response to the caller.
        }
        if (!tokenExchangeResponse || !tokenExchangeResponse.token) {
            return false;
        }

        console.log('Exchanged token: ' + tokenExchangeResponse.token);
        return true;
    }
}

module.exports.TeamsMessagingExtensionsSearchAuthConfigBot = TeamsMessagingExtensionsSearchAuthConfigBot;