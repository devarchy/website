import React from 'react';

import route_spec from '../../util/route_spec';

import LinkMixin from '../mixins/link';

import LandingPage from '../pages/landing';


const AboutPage = props =>
    <div style={{margin: 'auto', maxWidth: 600, width: '100%', marginTop: 100}}>
        <p><b>Author</b></p>
        <p>
            The codebase is written by <LinkMixin url="http://brillout.com/" give_page_rank={true}>Romuald</LinkMixin>.
            Many catalogs have been created by Romuald which he maintains with the help of hundreds of contributors.
        </p>

        <br/>
        <p><b>Vision</b></p>
        <p>
            The vision is to help you find libraries and to help open source authors reach their audience.
            Maybe even one day to help you find other kinds of things, e.g. Web Apps.
            For now the focus is on programming libraries.
        </p>

        {/*
        <br/>
        <p><b>Roadmap</b></p>
        <ol>
            <li>
                <LinkMixin url="https://github.com/devarchy/frontend-catalogs#call-for-new-catalogs" give_page_rank={true}>
                    Further catalogs
                </LinkMixin>
                {' '}to cover more frontend development areas.
            </li>
            <li>
                To be determined.
            </li>
        </ol>
        */}

        <br/>
        <p><b>Contributions</b></p>
        <p>
            Feel free to contact Romuald if you want to participate.
        </p>

        <br/>
        <p><b>Contact</b></p>
        <p>
            Romuald's contact informations are over{' '}
            <LinkMixin url="http://brillout.com/" give_page_rank={true}>there</LinkMixin>
            .
        </p>
    </div>;

export default {
    page_route_spec: route_spec.from_crossroads_spec('/about'),
    component: AboutPage,
    hide_sidebar: true,
    get_page_head: () => {
        const pg = LandingPage.get_page_head();
        pg.dont_index = true;
        return pg;
    },
};

