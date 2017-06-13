module.exports = [
    {
        provider_name: 'github',
        scope: ['user:email'],
        identifier: {
            name: 'github_login',
            retriever: profile => profile.raw.login,
        },
    },
    {
        provider_name: 'twitter',
        config: {
            extendedProfile: true,
            getMethod: 'account/verify_credentials',
            getParams: {
                include_email: "true", // `true` -> OAuth dance fails
            },
        },
        identifier: {
            name: 'twitter_user_id',
            retriever: profile => profile.id,
        },
        private_info_retriever: pick.bind(null, ['email', 'location', 'description', 'url', 'followers_count', 'friends_count', 'listed_count', 'verified', 'lang','default_profile_image', 'default_profile', 'needs_phone_verification', 'created_at', 'favourites_count', 'utc_offset', 'time_zone', 'statuses_count', 'protected',  ]),
        info_retriever: pick.bind(null, ['id', 'screen_name', 'name', 'last_name', 'profile_image_url_https']),
    },
    {
        provider_name: 'facebook',
        scope: ['email'],
        identifier: {
            name: 'facebook_user_id',
            retriever: profile => profile.id,
        },
        profileParams: ['id' ,'name' , 'email', 'first_name' , 'last_name', 'gender' , 'link', 'locale', 'timezone', 'updated_time', 'verified', 'is_verified'],
        private_info_retriever: pick.bind(null, ['email', 'gender', 'link', 'locale', 'timezone', 'updated_time', 'verified', 'is_verified']),
        info_retriever: pick.bind(null, ['id', 'name', 'first_name', 'last_name']),
    },
];

function pick(keys, obj) {
    const ret = {};
    keys.forEach(k => ret[k] = obj[k]);
    return ret;
}
