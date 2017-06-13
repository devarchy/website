import assert_soft from 'assertion-soft';
import Thing from './thing.js';

class User extends Thing {
    get user_name() {
        return get_provider_info(this).name;
    }
    get user_provider_and_name() {
        return get_provider_info(this).provider_and_name;
    }
    get user_image() {
        return get_provider_info(this).avatar;
    }
};
User.type = 'user'; // UglifyJS2 mangles class name
export default User;

function get_provider_info(user) {
    const PROVIDERS = [
        {
            prop: 'github_login',
            get_name: user => (user.github_info||{}).login,
            get_avatar: user => (user.github_info||{}).avatar_url,
        },
        {
            prop: 'facebook_user_id',
            get_name: user => user.facebook_info.name,
            get_avatar: user => 'https://graph.facebook.com/'+user.facebook_user_id+'/picture',
        },
        {
            prop: 'twitter_user_id',
            get_name: user => user.twitter_info.screen_name,
            get_avatar: user => user.twitter_info.profile_image_url_https,
        },
    ];
    const provs = (
        PROVIDERS
        .filter(({prop}) => user[prop])
        .map(provider => ({
            get provider_and_name() {
                const name = this.name;
                assert_soft(name);
                return provider.prop + '->' + name;
            },
            get name() {
                return provider.get_name(user);
            },
            get avatar() {
                return provider.get_avatar(user);
            },
        }))
    );
    assert_soft(provs.length>0, user);
    assert_soft(provs.length===1, user);
    return provs[0];
}
