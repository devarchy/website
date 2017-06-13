import React from 'react';

import assert from 'assertion-soft';

import Thing from '../../../thing';
import rerender from '../../../rerender';

import {IconPro, IconCon} from '../../snippets/icon';
import FlipListMixin from '../../mixins/flip-list';
import ButtonSnippet from '../../snippets/button';
import ReviewpointSnippet from './review-point';


const ReviewpointAdder = ({resource, is_negative, ...props}) => (
    <ButtonSnippet
      onClick={() => {
          resource.commentable.add_reviewpoint({is_negative});
          rerender.carry_out();
      }}
      icon_position={'right'}
      text={'Add'}
      {...props}
    />
);

const ReviewpointListSnippet = ({resource}) => {
    assert(resource);
    assert(resource instanceof Thing);
    assert(resource.type==='resource');

    const reviewpoints = resource.commentable.reviewpoints;
    const disable_adder_button = reviewpoints.some(c => c.is_editing);

    return (
        <div>
            <FlipListMixin>
                { reviewpoints.map(review_point => <ReviewpointSnippet key={review_point.key} review_point={review_point}/>) }
            </FlipListMixin>
            <div className={"css_review_point_adders"}>
                <ReviewpointAdder
                  resource={resource}
                  is_negative={false}
                  icon={<IconPro/>}
                  alt={'Add Pro'}
                  disabled={disable_adder_button}
                />
                <ReviewpointAdder
                  resource={resource}
                  is_negative={true}
                  icon={<IconCon/>}
                  alt={'Add Con'}
                  disabled={disable_adder_button}
                />
            </div>
        </div>
    );
};

export default {
    component: ReviewpointListSnippet,
};
