import React from 'react';
import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';

import pretty_print from '../../../util/pretty_print';

import {TextButtonSnippet} from '../../snippets/button';


export const LineComp = props => <span className="css_line_component" {...props} />;

export const DescriptionLineUpvotes = ({thing}) => {
    assert(thing, thing);
    assert(thing.votable, thing);
    const number_of_upvotes = thing.votable.upvote.number_of();
    if( number_of_upvotes===0 ) {
        return null;
    }
    const text = number_of_upvotes+' upvote'+(number_of_upvotes===1?'':'s');
    return <LineComp>{ text }</LineComp>;
};

export const DescriptionLineAuthor = ({thing}) => <LineComp>{'by '}{ thing.author_name }</LineComp>;

export const DescriptionLineAge = ({thing}) => {
    /*
    assert(!thing.is_new || thing.is_editing);
    assert(thing.created_at);
    */
    if( !thing.created_at ) {
        return null;
    }
    const text_age = pretty_print.age(thing.created_at, {verbose: true})+' ago';
    return <LineComp>{text_age}</LineComp>;
};

export const DescriptionLineComments = ({thing}) => {
    assert(thing, thing);
    assert(thing.commentable, thing);
    const number_of_comments = thing.commentable.comments.filter(c => !c.is_editing).length;
    if( number_of_comments===0 ) {
        return null;
    }
    const text = number_of_comments+' comment'+(number_of_comments===1?'':'s');
    return <LineComp>{ text }</LineComp>;
};

export const DescriptionLineEdit = ({thing, element}) => {
    assert(thing);
    assert(element);
    if( thing.is_editing ) {
        return null;
    }
    if( ! thing.is_author ) {
        return null;
    }
    return (
        <LineComp>
            <TextButtonSnippet
              onClick={() => {
                  if( ! thing.draft.author ) {
                      thing.draft.author = Thing.things.logged_user.id;
                  }
                  assert_soft(thing.draft.author === Thing.things.logged_user.id);
                  thing.draft.text = thing.draft.text || thing.text;
                  thing.draft.explanation = thing.draft.explanation || thing.explanation;
                  thing.is_editing = true;
                  element.forceUpdate();
              }}
              text={'edit'}
            />
        </LineComp>
    );
};
