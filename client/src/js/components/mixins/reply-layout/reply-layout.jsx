import React from 'react';

var ReplyLayoutMixin = React.createClass({
    render: function(){

        const elems = get_elems( this.props.children, this );

        const className = [
            "reply-list",
            this.state.expanded && "expanded",
            this.props.className,
        ].filter(c => c).join(" ");

        return <div className={className}>
            { elems.Header }
            { this.state.expanded && <div className="reply-list__body">{elems._rest}</div> }
        </div>;
    },
    getInitialState: function(){
        return {expanded: !this.props.collapse};
    },
    toggle_expand: function(){
        this.setState({expanded: !this.state.expanded});
    },
});


const mixin_spec = {
    components: [
        {
            name: 'Header',
            render: function(elem) {
                return <div className="reply-list__header">
                    {
                        elem.props.children.map((child, i) =>
                            !this.props.collapse || !child.props.expand_toggle ?
                                child :
                                <span key={i} style={{cursor: 'pointer'}} onClick={this.toggle_expand}>
                                    {child}
                                </span>
                        )
                    }
                </div>;
            },
        },
        {
            name: 'Replies',
            multiple: true,
            optional: true,
            render: elem => <div className="reply-list__replies" key={elem.props.wrapper_key}>
                {elem}
            </div>,
        },
    ],
    allow_unknown_children: true,
};

setup_component();

export default {
    component: ReplyLayoutMixin,
};


function setup_component() { 
    const TransparentComponent = {
        render: function(){
            return <div>{this.props.children}</div>
        },
    };

    mixin_spec.components.forEach(spec => {
        ReplyLayoutMixin[spec.name] =
            React.createClass(
                Object.assign(
                    TransparentComponent,
                    {displayName: spec.name}));
    });
} 

function get_elems(children, elem) { 
    const elems = {};

    const error_intro = 'Wrong Usage of '+(elem.constructor.displayName || elem.constructor)+': ';

    elems._rest =
        children
        .map(child => {
            const child_type_name = child && child.type && (child.type.displayName || child.type);

            const spec = mixin_spec.components.find(spec => spec.name === child_type_name);

            if( ! spec ) {
                if ( ! mixin_spec.allow_unknown_children ) {
                    throw new Error( error_intro + 'unexpected child type: '+child_type_name );
                }
                return child;
            }

            if( elems[spec.name] && ! spec.multiple ) {
                throw new Error( error_intro + 'only one '+spec.name+' expected' );
            }

            const child_parsed = spec.render ? spec.render.call(elem, child) : child ;

            if( spec.multiple ) {
                (
                    elems[spec.name] =
                        elems[spec.name] || []
                )
                .push(child_parsed);
            }
            else {
                elems[spec.name] = child_parsed;
            }

            return child_parsed;
        });

    mixin_spec.components.forEach(spec => {
        if( ! elems[spec.name] && ! spec.optional) {
            throw new Error( error_intro + spec.name + ' is missing' );
        }
    });

    const getter = {
        _rest: elems._rest,
    }

    mixin_spec.components.forEach(spec => {
        Object.defineProperty(
            getter,
            spec.name,
            {
                get: () => {
                    const elS = elems[spec.name];
                    (elS.constructor === Array ? elS : [elS])
                    .forEach(el => {
                        elems._rest.splice(
                            elems._rest.indexOf(el) ,
                            1
                        );
                    });
                    return elS;
                },
            }
        );
    });

    return getter;
} 
