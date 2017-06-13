import React from 'react';

import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import classNames from 'classnames';

import Thing from '../../../thing';
import rerender from '../../../rerender';

import FaPlus from 'react-icons/lib/fa/plus';
import FaMinus from 'react-icons/lib/fa/minus';
import FaCaretUp from 'react-icons/lib/fa/caret-up';
import ReplyLayoutMixin from '../../mixins/reply-layout';
import {default as VoteBlock, VoteButton} from '../../snippets/vote-block';
import {TextButtonSnippet} from '../../snippets/button';
import {IconEdit, IconDisagree, IconAgree} from '../../snippets/icon';
import CommentList from '../../snippets/comment-list';

import {DescriptionLineUpvotes, DescriptionLineComments, LineComp} from '../../snippets/description-line';

const conj = ({number, verb, noun}) => { 
    let text = '';
    text += number;
    text += ' ';
    if( verb ) {
        text += verb;
        if( number===1 ) {
            text += 's';
        }
    }
    if( noun ) {
        text += noun;
        if( number!==1 ) {
            text += 's';
        }
    }
    return text;
}; 

const AgreeBar = ({height, width, borderRadius, review_point, style}) => { 
    const votes = (
        [false, true]
        .map(is_negative => review_point.votable.agreeing.number_of({is_negative}))
    );
    const n_pos = votes[0];
    const n_neg = votes[1];
    const pos_percentage = n_neg===0 ? 1 : n_pos/(n_pos+n_neg)
    const pos_width = width * pos_percentage;
    const neg_width = width - pos_width;
    return (
        <div
          style={Object.assign({
            display: 'inline-block',
            width,
            height,
            position: 'relative',
            verticalAlign: 'middle',
            top: 0,
            borderRadius,
        }, style)}>
            {
                [
                    {
                        className: "css_tag_color__background_color",
                        style: {
                            width: pos_width,
                            left: 0,
                         // backgroundColor: '#7dc6cd',
                        },
                    },
                    {
                        style: {
                            width: neg_width,
                            right: 0,
                            backgroundColor: '#e5e5e5',
                        },
                    },
                ]
                .map(({className, style}, i) =>
                    <div key={i} className={className} style={Object.assign({position: 'absolute', height, top: 0}, style)}></div>
                )
            }
        </div>
    );
} 

const DescriptionLineAgreeBar = ({review_point}) => { 
    return (
        <LineComp>
            <AgreeBar height={2} width={40} review_point={review_point} />
        </LineComp>
    );
}; 

class ReviewpointSnippet extends React.Component {
    constructor(props) {
        super(props);
        assert(this.props.review_point);
        assert(this.props.review_point.type === 'reviewpoint');
        assert([true, false].includes(this.props.review_point.is_a_negative_point));
        this.state = {is_saving_text: false};
    }
    render() {
        const review_point = this.props.review_point;
        const is_negative = review_point.is_a_negative_point;
        const symbol =
        <span
          className={classNames("css_reviewpoint_symbol"/*, is_negative && "css_reviewpoint_is_negative"*/, !is_negative && "css_tag_color__text")}
          style={{verticalAlign: 'middle'}}
         >
            { is_negative ? <FaMinus /> : <FaPlus /> }
        </span>
        return (
            <ReplyLayoutMixin.component
              collapse={true}
              freeze={review_point.is_editing}
              className="css_reviewpoint"
            >

                <ReplyLayoutMixin.component.Header>
                    { !review_point.is_editing &&
                        <div style={{whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', }}>
                            { symbol }
                            <span style={{verticalAlign: 'middle',}}>{review_point.text}</span>
                            { review_point.explanation && <span style={{color: '#999', fontSize: 13.333, verticalAlign: 'middle',}}>{' '}{review_point.explanation}</span> }
                        </div>
                    }
                    { review_point.is_editing &&
                        <div>
                            { symbol }
                            <input
                              className="css_da"
                              autoFocus={review_point.is_new}
                              disabled={this.state.is_saving_text}
                              style={{verticalAlign: 'middle',}}
                              defaultValue={review_point.draft.text||review_point.text}
                              placeholder={'Short description'}
                              onChange={ev => review_point.draft.text = ev.target.value}
                            />
                        </div>
                    }
                    { review_point.is_editing &&
                        <div>
                            <textarea
                              autoFocus={!review_point.is_new}
                              disabled={this.state.is_saving_text}
                              defaultValue={review_point.draft.explanation||review_point.explanation}
                              rows="4"
                              style={{width: '100%', maxWidth: 500, display: 'block', marginTop: 4 }}
                              className="css_da"
                              onChange={ev => review_point.draft.explanation = ev.target.value}
                              placeholder={'Explanation (Optional)'}
                            />
                            <div>
                                <TextButtonSnippet
                                  onClick={this.save_text}
                                  css_saving={this.state.is_saving_text}
                                  disabled={this.state.is_saving_text}
                                  text={'save'}
                                />
                                <TextButtonSnippet
                                  css_is_secondary={true}
                                  text={'cancel'}
                                  onClick={ev => {
                                    review_point.is_editing = false;
                                    rerender.carry_out();
                                  }}
                                  disabled={this.state.is_saving_text}
                                />
                            </div>
                        </div>
                    }
                    { !review_point.is_editing &&
                        <div className="css_description_line">
                            <DescriptionLineUpvotes thing={review_point} />
                            <DescriptionLineComments thing={review_point} />
                            <DescriptionLineAgreeBar review_point={review_point} />
                        </div>
                    }
                </ReplyLayoutMixin.component.Header>

                <ReplyLayoutMixin.component.Replies
                  wrapper_key={"reviewpoints-for-"+review_point.key}
                  className={"css_review_point_body"}
                >
                    { ( review_point.explanation || Thing.things.logged_user ) &&
                        <div style={{marginBottom: 20}}>
                            { <span style={{wordWrap: 'break-word', marginRight: 13}}>{review_point.explanation||review_point.text}</span> }
                            { review_point.is_author &&
                                <TextButtonSnippet
                                  onClick={() => {review_point.is_editing = true; rerender.carry_out()}}
                                  icon={<IconEdit />}
                                  css_is_secondary={true}
                                  text={'Edit'}
                                  no_text={true}
                                />
                            }
                        </div>
                    }

                    <div style={{marginBottom: 20}}>
                        <VoteBlock
                          style={{paddingTop: 6, display: 'inline-block', marginRight: 10}}
                          thing={review_point}
                          spec={[
                            {
                                is_negative: false,
                                vote_type: 'upvote',
                                text: 'Upvote',
                                icon: <FaCaretUp/>,
                            },
                          ]}
                        />
                        <span style={{verticalAlign: 'middle'}}>
                            <span style={{marginRight: 10}}>
                                {' '}
                                {conj({noun: 'upvote', number: review_point.votable.upvote.number_of()})}
                            </span>
                            <div className="css_p css_note" style={{fontSize: 10, display: 'inline-block'}}>
                                (Upvotes determine how useful/important <code className="css_da css_inline">{review_point.text}</code> is.)
                            </div>
                        </span>
                    </div>

                    <VoteBlock thing={review_point} style={{marginBottom: 23}}>
                        <VoteButton
                          spec={{
                              is_negative: false,
                              vote_type: 'agreeing',
                              text: 'Agree',
                              icon: <IconAgree />,
                          }}
                          style={{marginRight: 10}}
                        />
                        <span style={{verticalAlign: 'middle'}}>
                            <span>
                                {conj({verb: 'agree', number: review_point.votable.agreeing.number_of()})}
                                {' '}
                            </span>
                            <AgreeBar height={2} width={40} review_point={review_point} style={{margin: '0 5px'}} />
                            <span>
                                {' '}
                                {conj({verb: 'disagree', number: review_point.votable.agreeing.number_of({is_negative: true})})}
                            </span>
                        </span>
                        <VoteButton
                          spec={{
                              is_negative: true,
                              vote_type: 'agreeing',
                              text: 'Disagree',
                              icon: <IconDisagree/>,
                          }}
                          style={{marginLeft: 10}}
                        />
                    </VoteBlock>

                    <CommentList thing={review_point} usernote_type={'comment'} />
                </ReplyLayoutMixin.component.Replies>

            </ReplyLayoutMixin.component>
        );

    }
    save_text = ev => {
        ev.preventDefault();
        this.setState({is_saving_text: true});
        const review_point = this.props.review_point;
        if( ! review_point.draft.author ) {
            review_point.draft.author = Thing.things.logged_user.id;
        }
        assert_soft(review_point.draft.author === Thing.things.logged_user.id);
        review_point.draft.save()
        .then(() => {
            review_point.is_editing = false;
            this.setState({is_saving_text: false});
            rerender.carry_out();
        });
    }
}

export default ReviewpointSnippet;
