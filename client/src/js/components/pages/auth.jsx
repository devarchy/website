import React from 'react';

import route_spec from '../../util/route_spec';
import assert_soft from 'assertion-soft';

import {SERVER_URI} from '../../util/server_uri';

import LandingPage from '../pages/landing';
import {BigButtonSnippet} from '../snippets/button';
import LinkMixin from '../mixins/link';

const LoginButton = ({
      name,
      favicon_adjustements={},
      favicon_url="http://"+name.toLowerCase()+".com/favicon.ico",
      is_last,
    }) => {
    return (
            <div style={{display: 'inline-block'}}>
                <LinkMixin
                  url={SERVER_URI+"/auth/"+name.toLowerCase()}
                >
                    <BigButtonSnippet>
                        <span style={{position: 'relative', top: 2}}>
                            <span
                              style={
                                  Object.assign(
                                      {
                                          verticalAlign: 'middle',
                                          display: 'inline-block',
                                          background: 'url('+favicon_url+')',
                                          backgroundRepeat: 'no-repeat',
                                          backgroundSize: 'contain',
                                          width: 17,
                                          height: 17,
                                          position: 'relative',
                                          top: -2,
                                          paddingRight: 4,
                                          marginRight: 7,
                                      },
                                      favicon_adjustements,
                                  )
                              }
                            />
                            {name}
                        </span>
                    </BigButtonSnippet>
                </LinkMixin>
                {!is_last && <span style={{verticalAlign: 'middle', margin: '0 9px'}}>or</span>}
            </div>
    );
};

const AuthPage = ({meta_data: {is_dev, is_programming_stuff}}) => {
    const endpoints = (() => { 
        assert_soft([true, false].includes(is_dev));
        assert_soft([true, false].includes(is_programming_stuff));
        const endpoints_dev = [
            {
                name: 'GitHub',
                favicon_adjustements: {
                    /*
                    width: 16,
                    height: 16,
                    */
                },
            },
        ];
        const endpoints_mainstream = [
            {
                name: 'Facebook',
                favicon_url: 'https://www.facebook.com/images/fb_icon_325x325.png',
                favicon_adjustements: {
                },
            },
            {
                name: 'Twitter',
                favicon_url: 'https://abs.twimg.com/favicons/favicon.ico',
                favicon_adjustements: {
                    width: 17,
                    height: 17,
                },
            },
        ];
        if( is_dev ) {
            return endpoints_mainstream.concat(endpoints_dev);
        }
        if( is_programming_stuff ) {
            return endpoints_dev;
        }
        return endpoints_mainstream;
    })(); 
    return (
        <div className="css_center">
            <div>
                <span style={{marginRight: 10, verticalAlign: 'middle',}}>
                    Login with
                </span>
                { endpoints.map((props, i) => <LoginButton {...props} is_last={i===endpoints.length-1} key={i}/>) }
                <div className="css_note css_p" style={{marginTop: 50, fontSize: '0.85em'}}>
                    Your email is the only permission asked and it'll be treated well.
                </div>
            </div>
        </div>
    );
}

export default {
    page_route_spec: route_spec.from_crossroads_spec('/auth'),
    component: AuthPage,
    hide_sidebar: true,
    get_page_head: () => {
        const pg = LandingPage.get_page_head();
        pg.dont_index = true;
        return pg;
    },
};

