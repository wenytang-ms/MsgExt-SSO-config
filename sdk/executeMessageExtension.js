// sign in link
async function getSignInLink(context, oauthConnect) {
    const userTokenClient = context.turnState.get(context.adapter.UserTokenClientKey);
    const signInResource = await userTokenClient.getSignInResource(oauthConnect, context.activity, undefined);
    const signInLink = signInResource.signInLink;
    return signInLink;
}

// sdk design with a callback function
async function executionWithOauthConnect(context, oauthConnect, logic) {
    if (!valueObj.authentication || !valueObj.authentication.token) {
        const signInLink = await getSignInLink(context, oauthConnect);
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
    const userTokenClient = context.turnState.get(context.adapter.UserTokenClientKey);
    const magicCode =
        context.state && Number.isInteger(Number(context.state))
            ? context.state
            : '';
    const tokenResponse = await userTokenClient.getUserToken(context.activity.from.id, oauthConnect, context.activity.channelId, magicCode);
    if (!tokenResponse || !tokenResponse.token) {
        const signInLink = await getSignInLink(context, oauthConnect);
        return {
            composeExtension: {
                type: 'auth',
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
    return await logic(tokenResponse.token);
}
exports.executionWithOauthConnect = executionWithOauthConnect;