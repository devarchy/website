/*
 Twitter

 With twitcount.com counter;
 - https://jsfiddle.net/upwexg9a/

<a href="https://twitter.com/share" class="twitter-share-button" data-text="Catalog of React Components &amp; Libraries" data-url="https://devarchy.com/react-components" data-via="brillout" data-hashtags="react" data-related="brillout" data-dnt="true" data-show-count="false">Tweet</a><script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>


 GitHub

 <!-- Place this tag where you want the button to render. -->
 <a class="github-button" href="https://github.com/brillout/awesome-react-components" data-icon="octicon-star" data-show-count="true" aria-label="Star brillout/awesome-react-components on GitHub">Star</a>

 <!-- Place this tag in your head or just before your close body tag. -->
 <script async defer src="https://buttons.github.io/buttons.js"></script>

*/

import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import user_tracker from '../../../user_tracker';
import LoadingSnippet from '../../snippets/loading';
import LinkMixin from '../../mixins/link';
import Promise from 'bluebird';


class ClickCatcher extends React.Component {
// - https://gist.github.com/jaydson/1780598
// - http://stackoverflow.com/questions/27597552/how-to-detect-onclick-event-on-iframe-cross-domain

    componentDidMount() {
        this.blur_listener = () => {
            this.props.on_supposed_click();
        };
    }
    componentWillUnmount() {
        this.handle_listener({remove: true});
    }
    render() {
        return (
            <div
              style={this.props.style}
              className={this.props.className}
              onMouseEnter={() => {
                this.handle_listener();
              }}
              onMouseLeave={() => {
                this.handle_listener({remove: true});
              }}
            >
                {this.props.children}
            </div>
        );
    }
    handle_listener({remove}={}) {
        if( ! assert_soft(typeof window !== "undefined") ) return;
        if( ! remove ) {
            // https://gist.github.com/jaydson/1780598#gistcomment-1482366
            window.focus();
        }
        window[remove?'removeEventListener':'addEventListener']('blur', this.blur_listener, {passive: true});
    }

};

const BTN_CLS_GITHUB = "css_social__github";
const BTN_CLS_TWITTER = "css_social__twitter";

/*
const TwitterButton = ({twitter_hash, catalog_name, catalog_title, catalog_desc}) => {
    return (
        <ClickCatcher
          className={BTN_CLS_TWITTER}
          style={{
            minWidth: 61,
            position: 'relative',
          }}
          on_supposed_click={() => {
            //track_twitter();
          }}
        >
            <a
              href="https://twitter.com/share"
              rel="nofollow"
              className="twitter-share-button"
              data-text={catalog_desc}
              data-url={"https://devarchy.com/"+catalog_name}
              data-via="brillout"
              data-hashtags={twitter_hash}
              data-related="brillout"
              data-dnt="true"
              data-show-count="false"
            />
        </ClickCatcher>
    );
};
*/

/*
const TwitterButton = ({twitter_hash, catalog_name, catalog_title, catalog_desc}) => {
    let url = 'https://twitter.com/intent/tweet?hashtags=react&original_referer=http%3A%2F%2Flocalhost%3A8082%2F&ref_src=twsrc%5Etfw&related=brillout&text=Catalog%20of%20React%20components%20%26%20libraries&tw_p=tweetbutton&url=https%3A%2F%2Fdevarchy.com%2Freact-components&via=brillout';
    // url = 'https://twitter.com/intent/tweet?hashtags=react&related=brillout&text=Catalog%20of%20React%20components%20%26%20libraries&url=https%3A%2F%2Fdevarchy.com%2Freact-components&via=brillout';
    return (
        <div
          ref={el => el.onclick = () => {
              window.open(url, 'link_popup', 'width=300,height=300');
          }}
        >
            {
            // Popup not blocked.
            }
            <a href={'https://twitter.com/'} onClick={(ev) => {ev.preventDefault(); return false}}>tweet[popup_allowed]</a>
            {' '}
            {
            // Popup blocked.
            // - Chrome seems to block popup's open in onclick event of elements that were the target of document.querySelector
            // - Popup doesn't get blocked when twitter vendor code is not running
            // -> my suspicion is that twitter retrieves links starting with `https://twitter.com/intent/tweet`
            // -> popup get's blocked
            }
            <a href={'https://twitter.com/intent/tweet'} onClick={(ev) => {ev.preventDefault(); return false}}>tweet[popup_blocked]</a>
        </div>
    );
};
*/

const TwitterButton = ({twitter_hash, catalog_name, catalog_title, catalog_desc}) => {
    const url_shared = "https://devarchy.com/"+catalog_name;
    const url_twitter = (
        'https://twitter.com/intent/tweet?'+
        Object.entries({
            url: url_shared,
            text: catalog_desc,
            hashtags: twitter_hash,
            via: 'brillout',
            related: 'brillout',
        })
        .map(([key, val]) => key+'='+encodeURIComponent(val))
        .join('&')
    );
    return (
        <div
          className={BTN_CLS_TWITTER}
          style={{
            minWidth: 61,
            minHeight: 20,
            position: 'relative',
          }}
        >
            <a
              href="https://twitter.com/share"
              rel="nofollow"
              className="twitter-share-button"
              data-text={catalog_desc}
              data-url={url_shared}
              data-via="brillout"
              data-hashtags={twitter_hash}
              data-related="brillout"
              data-dnt="true"
              data-show-count="true"
            />
            <LinkMixin
              url={url_twitter}
              alt={catalog_title}
              empty_text={true}
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
              }}
              track_info={{
                category: 'social_share',
                action: 'social_share_twitter',
              }}
            />
        </div>
    );
};


const GithubButton = ({github_full_name, catalog_title}) => {
    return (
        <div
          className={BTN_CLS_GITHUB}
          style={{
            minWidth: 94,
            minHeight: 20,
            position: 'relative',
          }}
        >
            <a
              href={"https://github.com/"+github_full_name}
              rel="nofollow"
              style={{display: 'none'}}
              className="github-button"
              data-icon="octicon-star"
              data-show-count="true"
              aria-label={"Star "+github_full_name+" on GitHub"}
            >Star</a>
            <LinkMixin
              url={'https://github.com/'+github_full_name}
              give_page_rank={true}
              alt={catalog_title}
              empty_text={true}
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
              }}
              track_info={{
                category: 'github_star_link',
                action: 'star_link_click',
              }}
            />
        </div>
    );
}

const SocialButtonsSnippet = ({catalog, style, className}) => {
    const props = {
        twitter_hash: catalog.display_options.tag_twitter_hash,
        github_full_name: catalog.markdown_list__github_full_name,
        catalog_name: catalog.name,
        catalog_title: catalog.display_options.tag_title,
        catalog_desc: catalog.display_options.tag_description__without_number,
        show_twitter_share_button: catalog.display_options.tag_accepts_new_entries,
    };

    Object
    .entries(props)
    .forEach(([key, val]) => {
        assert_soft([true, false].includes(val) || val && val.constructor===String, key, props);
    });

    return (
        <div
          className={className}
          style={Object.assign({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 50,
            marginBottom: 10,
            position: 'relative',
          }, style)}
        >
            <div className='css_social__loading_cover'>
                <LoadingSnippet.component size={18}/>
            </div>
            <GithubButton {...props} />
            {props.show_twitter_share_button && <div style={{width: 25}} />}
            {props.show_twitter_share_button && <TwitterButton {...props} />}
        </div>
    );
};

export default {
    component: SocialButtonsSnippet,
    install_mounted_buttons,
};


function install_mounted_buttons() {
    if( ! assert_soft(typeof window !== "undefined") ) return;

    Promise.all([
        load_twitter_code(),
        load_github_code(),
    ])
    .then(() => {
        const loading_cover = document.querySelectorAll('.css_social__loading_cover');
        if( loading_cover.length === 0 ) return;
        assert_soft(loading_cover.length === 1);
        loading_cover.forEach(el => el.classList.add('css_conceil'));
    });

    return;

    function load_twitter_code() {
        return (
            load_code({
                name: 'twitter',
                script_spec: {
                    src: '//platform.twitter.com/widgets.js',
                    async: true,
                    charset: 'utf-8',
                },
                class_name: BTN_CLS_TWITTER,
                on_load: () => {
                    /*
                    twttr.widgets.createShareButton(
                        "https:\/\/dev.twitter.com\/web\/tweet-button",
                        document.querySelector(".twitter-share-button"),
                        {
                            text: "custom share text",
                            hashtags: "example,demo",
                            via: "twitterdev",
                            related: "twitterapi,twitter"
                        }
                    );
                    */
                },
            })
        );
    }

    function load_github_code() {
        return (
            load_code({
                name: 'github',
                script_spec: {
                    src: 'https://buttons.github.io/buttons.js',
                    async: true,
                    defer: true,
                },
                class_name: BTN_CLS_GITHUB,
            })
        );
    }

    function load_code({name, script_spec, class_name, on_load}) {
        return (
            new Promise(resolve => {
                const buttons = window.document.querySelectorAll('.'+class_name);
                if( buttons.length === 0 ) {
                    resolve();
                    return;
                }
                assert_soft(buttons.length===1, class_name);
                const script_el = window.document.createElement('script');
                Object.entries(script_spec)
                .forEach(([key, val]) => {
                    script_el.setAttribute(key, val);
                });
                script_el.onload = () => {
                    if( on_load ) on_load();
                    setTimeout(() => {
                        buttons.forEach(btn => btn.classList.add('css_reveal'));
                        resolve();
                    }, 1500);
                };
                document.head.appendChild(script_el);
            })
        );
    }
}
