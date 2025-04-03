import ThirdParty from "supertokens-node/recipe/thirdparty";
import Passwordless from "supertokens-node/recipe/passwordless";
import Session from "supertokens-node/recipe/session";
import Dashboard from "supertokens-node/recipe/dashboard";
import UserRoles from "supertokens-node/recipe/userroles";
import { appInfo } from "./appInfo";
import { type TypeInput } from "supertokens-node/types";
import SuperTokens from "supertokens-node";

export let backendConfig = (): TypeInput => {
    return {
        framework: "awsLambda",
        isInServerlessEnv: true,
        supertokens: {
            connectionURI: "https://st-dev-8b0aad20-da7b-11ef-8c4b-53905c1f8f99.aws.supertokens.io",
            apiKey: process.env.NITRO_SUPERTOKENS_API_KEY,
        },
        appInfo,
        // recipeList contains all the modules that you want to
        // use from SuperTokens. See the full list here: https://supertokens.com/docs/guides
        recipeList: [
            ThirdParty.init({
                signInAndUpFeature: {
                    providers: [
                        // We have provided you with development keys which you can use for testing.
                        // IMPORTANT: Please replace them with your own OAuth keys for production use.
                        {
                            config: {
                                thirdPartyId: "google",
                                clients: [
                                    {
                                        clientId:
                                            "1060725074195-kmeum4crr01uirfl2op9kd5acmi9jutn.apps.googleusercontent.com",
                                        clientSecret: "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",
                                    },
                                ],
                            },
                        },
                        {
                            config: {
                                thirdPartyId: "github",
                                clients: [
                                    {
                                        clientId: "467101b197249757c71f",
                                        clientSecret: "e97051221f4b6426e8fe8d51486396703012f5bd",
                                    },
                                ],
                            },
                        },
                    ],
                },
            }),
            Passwordless.init({
                contactMethod: "EMAIL_OR_PHONE",
                flowType: "USER_INPUT_CODE_AND_MAGIC_LINK",
            }),
            Session.init(),
            Dashboard.init(),
            UserRoles.init(),
        ],
    };
};

let initialized = false;
export function ensureSuperTokensInit() {
    if (!initialized) {
        SuperTokens.init(backendConfig());
        initialized = true;
    }
}