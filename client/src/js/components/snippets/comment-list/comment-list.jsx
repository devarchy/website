import React from 'react';

import assert from 'assertion-soft';

import CommentSnippet from './comment';
import FlipListMixin from '../../mixins/flip-list';
import {IconButton} from '../../snippets/button';
// import GoComment from 'react-icons/lib/go/comment';

import rerender from '../../../rerender';

import Thing from '../../../thing';


const CommentAdder = ({thing, style}) => {
    const comments = thing.commentable.comments;
    const disabled = comments.some(c => c.is_editing);
    return (
        <IconButton
          disabled={disabled}
          onClick={ () => {
              thing.commentable.add_comment();
              rerender.carry_out();
          }}
          style={style}
          icon={
              <i className="octicon octicon-comment css_1px_down" style={{verticalAlign: 'middle'}}/>
           // <GoComment className="css_1px_down" style={{verticalAlign: 'middle', color: '#bbb'}}/>
          }
          text={'Comment'}
        />
    );
};

const CommentList = ({thing, className, style}) => {
    const comments = thing.commentable.comments;
    return (
        <div className={className} style={style}>
            <FlipListMixin>
                {
                    comments.reverse().map(comment =>
                        <CommentSnippet.component
                          key={comment.key}
                          comment={comment}
                        />)
                }
            </FlipListMixin>
        </div>
    );
};

export {CommentList, CommentAdder, CommentList as default};
