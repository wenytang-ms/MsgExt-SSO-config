// sdk design with a callback function
async function executionWithOauthConnect(context, oauthConnect, query, logic) {
    const userTokenClient = context.turnState.get(context.adapter.UserTokenClientKey);
    const magicCode = query.state && Number.isInteger(Number(query.state))
        ? query.state
        : '';
    const tokenResponse = await userTokenClient.getUserToken(context.activity.from.id, oauthConnect, context.activity.channelId, magicCode);
    if (!tokenResponse || !tokenResponse.token) {
        const signInResource = await userTokenClient.getSignInResource(oauthConnect, context.activity, undefined);
        const signInLink = signInResource.signInLink;
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