import React from 'react';
import assert_soft from 'assertion-soft';


export const CatalogLogo = ({tag}) => {
    const {tag_logo} = tag.display_options;

    assert_soft(tag_logo, tag);

    return (
        tag_logo && (
          <div
            className="sel_catalog_logo"
            style={{
                backgroundImage: 'url('+tag_logo+')',
                height: '100%',
                width: '100%',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: '100%',
                display: 'inline-block',
            }}
          />
        ) || null
    );
};

export const CatalogName = ({tag}) => {
    const {tag_title__multiline} = tag.display_options;

    return (
        <div
            className="css_catalog_title"
        >
            {tag_title__multiline}
        </div>
    );
};

const CatalogTitleSnippet = ({tag}) => {
    const logo = <CatalogLogo tag={tag} />;
    const text = <CatalogName tag={tag} />;

    return (
        <div className="css_header" style={{justifyContent: 'center'}}>
            <div style={{textAlign: 'center'}}>
                { logo && (
                    <div style={{display: 'inline-block', verticalAlign: 'middle', width: '6em', height: '6em', marginRight: '1.2em'}}>
                        {logo}
                    </div>
                ) }
                { text }
            </div>
        </div>
    );
};


export default CatalogTitleSnippet;
