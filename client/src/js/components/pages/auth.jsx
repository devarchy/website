import React from 'react';

import crossroads from 'crossroads';

import {SERVER_URI} from '../../util/server_uri';

import LandingPage from '../pages/landing';


const AuthPage = () =>
    <div className="css_center" style={{fontSize: '1.2em'}}>
        <div>
        <div>
            <a
              href={SERVER_URI+"/auth/github"}
            >
                <button
                  className="css_primary_button css_unpressed_button"
                >
                    <span
                      className="css_color_contrib"
                      style={{position: 'relative', top: 1}}
                    >
                        <i
                        className="fa fa-github"
                        style={{color: '#6d6d6d', fontSize: '1.45em', verticalAlign: 'middle', position: 'relative', top: -1, paddingRight: 5}}
                        />
                        Login
                    </span>
                </button>
            </a>
        </div>
        <div className="css_note css_p">
            Your email is the only permission asked and<br/>it will never be spammed nor given away.
        </div>
        </div>
    </div>;


export default {
    route: crossroads.addRoute('/auth'),
    component: AuthPage,
    get_page_head: LandingPage.get_page_head,
};

