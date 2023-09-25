
async function executionWithOauthConnect(context, oauthConnect, query, logic) {
    const userTokenClient = context.turnState.get(context.adapter.UserTokenClientKey);
    console.log('---------------step 2');
    const magicCode = query.state && Number.isInteger(Number(query.state))
        ? query.state
        : '';
    const tokenResponse = await userTokenClient.getUserToken(context.activity.from.id, oauthConnect, context.activity.channelId, magicCode);
    console.log('---------------step 3');
    if (!tokenResponse || !tokenResponse.token) {
        const signInResource = await userTokenClient.getSignInResource(oauthConnect, context.activity, undefined);
        const signInLink = signInResource.signInLink;
        console.log('---------------step 4');
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
    console.log('---------------step 5', tokenResponse.token);
    return await logic(tokenResponse.token);
}
exports.executionWithOauthConnect = executionWithOauthConnect;