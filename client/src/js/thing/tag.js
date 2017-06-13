import assert from 'assertion-soft';
import assert_soft from 'assertion-soft';
import timerlog from 'timerlog';
import Thing from './thing';
import Resource from './resource';
import text_search from '../util/text_search';
import NeedsAndLibsPage from '../components/pages/needs-and-libs';


const cache__childs = {};
const cache__tags = {};

class Tag extends Thing {
    constructor(...args) { 
        super(...args );

        if( this.name ) {
            cache__tags[this.name] = this;
        }

        delete cache__childs[this.parent_tag_id];
    } 

    get display_options() { 
        assert(this.is_markdown_list || this.is_npm_list);

        const d_opts = {};

        let tag_accepts_new_entries,
            tag_color,
            tag_collapse_depth,
            tag_description,
            tag_description__addendum,
            tag_description__addendum__important,
            tag_logo,
            tag_title,
            tag_twitter_hash;

        tag_accepts_new_entries = true;
        tag_color = 'pink';
        tag_collapse_depth = 1;

        if( this.is_npm_list ) {
            tag_title = titlelize__npm_list(this.name);
        }

        if( this.is_markdown_list ) {
            assert(this.markdown_list__github_full_name);
            tag_title = titlelize__repo_name(this.markdown_list__github_full_name);
        }

        if( this.name==='redux' ) {
            tag_color = '#764abc'
            tag_logo = "https://cdn.rawgit.com/brillout/awesome-redux/master/redux-logo.svg";
            tag_twitter_hash='redux';
            tag_title='Redux';
            tag_description='Redux Libraries';
        }
        if( ['react-components', 'react'].includes(this.name) ) {
            tag_title = 'React';
            tag_description = 'React components & libraries';
            tag_color = '#00d8ff';
            tag_logo = "https://cdn.rawgit.com/brillout/awesome-react-components/master/react-logo.svg";
            tag_twitter_hash='react';
        }
        if( ['angular-components', 'angular'].includes(this.name) ) {
            tag_title = 'Angular';
            tag_description = 'Angular 2+ components & libraries';
            tag_color = '#1e88e5';
            tag_logo = "https://cdn.rawgit.com/brillout/awesome-angular-components/master/angular-logo.svg";
            tag_twitter_hash='angular';
        }
        if( this.name==='vue' ) {
            tag_accepts_new_entries = false;
            tag_title = 'Vue';
            tag_description = 'Vue 2 components & libraries';
            tag_color = '#42b983';
            tag_logo = 'https://vuejs.org/images/logo.png';
            tag_twitter_hash='vuejs';
        }
        if( this.name==='web-apps' ) {
            tag_color = '#7dc6cd';
            tag_collapse_depth = 2;
            tag_title = 'Web Apps';
            tag_logo = "https://cdn.rawgit.com/brillout/awesome-web-apps/a984802d99519a6909466a1bd1f70265d2d7c827/web-logo.svg";
            tag_twitter_hash='webapp';
        }
        if( ['frontend-libraries', 'frontend'].includes(this.name) ) {
         // tag_color = '#ef652a';
            tag_color = '#e34f26';
            tag_title = "Frontend";
            tag_description = "Frontend Libraries";
            tag_description__addendum = "(No jQuery plugins.)";
            tag_description__addendum__important = "This catalog is working-in-progress and is missing many libraries.";
            tag_logo = "https://cdn.rawgit.com/brillout/awesome-frontend-libraries/master/logo.svg";
            tag_twitter_hash='frontend';
        }

        if( this.name==='frontend-catalogs' ) {
            tag_color = '#5ae88d';
        }

        const tag_description__long = 'Catalog of $n '+(tag_description||tag_title);

        const tag_description__without_number = tag_description__long.replace(' $n', '');

        const tag_title__multiline = break_line(tag_title);

        return {
            tag_accepts_new_entries,
            tag_color,
            tag_collapse_depth,
            tag_description,
            tag_description__long,
            tag_description__addendum,
            tag_description__addendum__important,
            tag_description__without_number,
            tag_logo,
            tag_title,
            tag_title__multiline,
            tag_twitter_hash,
        };

        function break_line(str) { 
            const words = str.split(' ');
            if( words.length === 1 ) return words[0];
            const text_top = words.slice(0,words.length/2).join(' ');
            const text_bot = words.slice(words.length/2).join(' ');
            if( text_top.length<=4 || text_top.length + text_bot.length < 10 ) {
                return text_top + ' ' + text_bot;
            }
            return text_top + '\n' + text_bot;
        } 

        function titlelize__npm_list(str) { 
            return (
                titlelize(
                    strip_npm_prefix(
                        str
                    )
                )
            );

            function strip_npm_prefix(str) {
                return str.replace(/[^npm_]/, '');
            }
        } 

        function titlelize__repo_name(str) { 
            return (
                titlelize(
                    strip_awesome(
                        get_name(
                            str
                        )
                    )
                )
            );

            function get_name(str) {
                const n = str.split('/')[1];
                assert_soft(n);
                return n||'';
            }
            function strip_awesome(str) {
                return str.replace(/[^a-z0-9]?awesome[^a-z0-9]?/ig, '');
            }
        } 

        function titlelize(str) { 
            return (
                add_libraries(
                    capitalize_words(
                        turn_into_words(
                            str
                        )
                    )
                )
            );

            function turn_into_words(str) {
                return (
                    str
                    .split(/[-_]/)
                    .filter(str => str.length > 0)
                    .join(' ')
                );
            }
            function capitalize_words(str) {
                return (
                    str
                    .split(' ')
                    .map(str => str.length < 4 ? str : str.slice(0,1).toUpperCase()+str.slice(1))
                    .join(' ')
                );
            }
            function add_libraries(str) {
                if( str.toLowerCase().includes('librar') ) {
                    return str;
                }
                return (
                    str+' Libraries'
                );
            }
        } 
    } 

    static get_meta_list_name({meta_data: {is_programming_stuff}}) { 
        assert_soft([true, false].includes(is_programming_stuff));
        const meta_lists = this.all_meta_lists;
        return (
            is_programming_stuff ? (
                meta_lists.prog
            ) : (
                meta_lists.web
            )
        );
    } 

    get is_meta_list() { 
        return (
            Object.values(Tag.all_meta_lists).includes(this.name)
        );
    } 

    static get all_meta_lists() { 
        return {
            prog: 'frontend-catalogs',
            web: 'websites',
        };
    } 

    static get_root_lists() { 
        return (
            (Thing.things.of_type.tag||[])
            .filter(t => t.is_markdown_list && !t.is_meta_list)
            .sort((t1, t2) => t2.name < t1.name)
        );
    } 

    category__path({without_root}={}) { 
        assert_soft(!this.is_removed, this);
        assert(this.is_markdown_category);
        return (
            this
            .ancestor_tags
            .reverse()
            .slice(without_root?1:0)
            .concat(this)
            .map(ancestor => (
                ancestor.is_markdown_list ? (
                    ancestor.display_options.tag_title
                ) : (
                    ancestor.category__title
                )
            ))
            .join(' > ')
        );
    } 

    get category__title() { 
        assert_soft(this.is_category);
        return this.title;
    } 

    get category__human_id() { 
        assert_soft(this.is_category);
        return Thing.generate_human_id(
            this.category__title
        );
    } 

    get child_tags() { 
        assert(this.id);
        assert(this.is_markdown_category !== this.is_markdown_list);
        if( ! cache__childs[this.id] ) {
            cache__childs[this.id] = (
             // Thing.things.all
                Thing.things.of_type.tag
                .filter(t => t.parent_tag_id === this.id)
                .filter(t => !t.is_removed)
                .sort((cat1, cat2) => cat1.category_order - cat2.category_order)
            );
        }
        return cache__childs[this.id];
    } 

    get descendant_tags() { 
        assert(this.id);
        return (
            this.child_tags
            .map(child_tag => [child_tag].concat(child_tag.descendant_tags))
            .reduce((prev,curr) => prev.concat(curr), [])
        );
    } 

    get parent_catalog() { 
        return (
            Tag.get_by_id(this.referred_tag_markdown_list)
        );
    } 

    get markdown_list_tag() { 
        assert(this.is_markdown_category || this.is_markdown_list);
        if( this.is_markdown_list ) {
            return this;
        }
        return this.parent_catalog;
    } 

    get parent_tag_id() { 
        if( ! this.is_markdown_category ) {
            return null;
        }
        const pid = (
            this.parent_category || this.referred_tag_markdown_list
        );
        assert(pid);
        return pid;
    } 

    get parent_tag() { 
        assert_soft(!this.is_removed, this);
        const pid = this.parent_tag_id;
        if( !pid ) {
            return null;
        }
        const p = Tag.get_by_id(pid, {can_be_null: true});
        assert_soft(p, "failed to get parent", this);
        return p;
    } 

    get ancestor_tags() { 
        assert_soft(!this.is_removed, this);
        if( this.is_markdown_list ) {
            return [];
        }
        const parent_ancestors = this.parent_tag.ancestor_tags;
        if( parent_ancestors.some(ancestor_tag => !ancestor_tag.id || ancestor_tag.id == this.parent_tag.id) ) {
            assert(false);
            throw new Error('infinite loop catched');
        }
        return [this.parent_tag].concat(parent_ancestors);
    } 

    get depth() { 
        return (
            this.ancestor_tags
            .length
        )
    } 

    get is_npm_list() { 
        return (
            this.name.startsWith('npm_')
        );
    } 

    get is_markdown_list() { 
        return (
            !! this.markdown_list__github_full_name
        );
    } 

    get is_markdown_category() { 
        // TODO replace with `is_category`
        return (
            !!this.referred_tag_markdown_list
        );
    } 

    get catalog__github_full_name() { 
        if( ! assert_soft(this.is_catalog) ) return null;
        if( ! assert_soft(this.markdown_list__github_full_name) ) return null;
        return (
            this.markdown_list__github_full_name
        );
    } 

    get catalog__source_url() { 
        const github_full_name = this.catalog__github_full_name;
        if( ! assert_soft(github_full_name) ) return null;
        return (
            'https://github.com/'+github_full_name
        );
    } 

    get is_catalog() { 
        return (
            !!this.markdown_list__github_full_name
        );
    } 

    get is_category() { 
        return (
            !!this.referred_tag_markdown_list
        );
    } 

    get_resource_by_human_id({resource_human_id}) { 
        return (
            (
                Resource
                .list_things({tags: [this]})
                .find(resource => resource.resource_human_id === resource_human_id)
            ) || null
        );
    } 

    get_all_info() { 
        assert(this.is_catalog);

        const tag = this;

        let resources__requests = [];

        const categories_resources = {};

        let number_of_included_resources = 0;

        Thing.things.of_type.resource
        .filter(resource =>
            resource.preview.tags.some(tagname => tagname===tag.name) &&
            resource.is_removed!==true
        )
        .forEach(resource => {
            const resource_tags = (() => {
                const tag_map = {};

                resource.preview.tags
                .forEach(name => {
                    assert_soft(name && name.constructor===String);

                    const resource_tag = Tag.get_by_name(name, {can_be_null: true});
                    if( !resource_tag ) { return; }
                    const id = resource_tag.id;
                    if( ! [resource_tag.id, resource_tag.referred_tag_markdown_list].includes(tag.id) ) {
                        return;
                    }
                    tag_map[id] = tag_map[id] || {resource_tag};
                    tag_map[id].is_approved = true;
                });

                resource.preview.tagreqs
                .forEach(tr => {
                    assert_soft(tr.req_tag_name, JSON.stringify(tr, null, 2));
                    assert_soft(tr.req_date===null || tr.req_date, JSON.stringify(tr, null, 2));
                    assert_soft([true, false, null].includes(tr.req_approved), JSON.stringify(tr, null, 2));
                    const name = tr.req_tag_name;

                    const resource_tag = Tag.get_by_name(name, {can_be_null: true});
                    if( !resource_tag ) { return; }
                    const id = resource_tag.id;
                    if( ! [resource_tag.id, resource_tag.referred_tag_markdown_list].includes(tag.id) ) {
                        return;
                    }
                    tag_map[id] = tag_map[id] || {resource_tag};
                    tag_map[id].req_date = tr.req_date;
                    tag_map[id].is_approved = tr.req_approved;
                });

                return Object.values(tag_map);
            })();

            {
                let is_approved_somewhere = false;

                resource_tags
                .filter(({is_approved, resource_tag}) => resource_tag.is_markdown_category===true)
                .forEach(({is_approved, resource_tag}) => {
                    const id = resource_tag.id;

                    if( ! categories_resources[id] ) {
                        categories_resources[id] = {
                            resources_included: [],
                            resources_awaiting: [],
                            resources_declined: [],
                        };
                    }

                    const target = (
                        ![true, false].includes(is_approved) && (
                            categories_resources[id].resources_awaiting
                        ) ||
                        is_approved===true && (
                            categories_resources[id].resources_included
                        ) || (
                            categories_resources[id].resources_declined
                        )
                    );

                    is_approved_somewhere = is_approved_somewhere || is_approved;

                    target.push(resource);
                });

             // number_of_included_resources += is_approved_somewhere ? 1 : 0;
                number_of_included_resources++;
            }

            resource_tags
            .filter(({req_date}) => !!req_date)
            .forEach(({resource_tag, req_date, is_approved}) => {
                resources__requests.push({
                    resource,
                    req_date,
                    is_approved,
                    category_display_name: (
                        ! resource_tag.is_markdown_category ?
                            '' :
                            resource_tag.category__path({without_root: true})
                    ),
                });
            });
        });

        resources__requests = resources__requests.sort((req1, req2) => new Date(req2.req_date) - new Date(req1.req_date));

        return {number_of_included_resources, resources__requests, categories_resources};
    } 

    get_missing_words(full_text_search_value, {per_text}={}) { 
        assert(this.is_category);
        assert(full_text_search_value);
        const title = this.category__title;
        const desc = this.category__desc;
        const elaboration = this.category__elaboration;
        const topics = this.category__topics.join('');
        assert(title);
        assert(desc);
        return (
            text_search.get_missing_words({
                full_text_search_value,
                texts: [
                    title,
                    topics,
                    desc,
                    elaboration,
                ],
                per_text,
            })
        );
    } 

    get category__desc() { 
        return (
            parse_category_description(this).desc
        );
    } 

    get category__topics() { 
        return (
            parse_category_description(this).topics
        );
    } 

    get category__permalink() { 
        assert(this.is_category);
        return (
            NeedsAndLibsPage
            .page_route_spec.interpolate_path({
                tag_name: this.parent_catalog.name,
                search__value: this.category__human_id,
                search__type: 'NEED_SEARCH',
            })
        );
    } 

    static topic__permalink({catalog_name, topic_name}) { 
        return (
            NeedsAndLibsPage
            .page_route_spec
            .interpolate_path({
                tag_name: catalog_name,
                search__value: Tag.get_topic_slug(topic_name),
                search__type: 'TOPIC_SEARCH',
            })
        );
    } 

    static get_topic_slug(topic_name) {
        return (
            Thing.generate_human_id(topic_name)
        );
    }

    static find_by_topic({catalog, topic_name}) { 
        const match_map = {};
        catalog
        .get_needs_list()
        .forEach(need => {
            if( need.category__topics.map(Tag.get_topic_slug.bind(Tag)).includes(topic_name) ) {
                match_map[need.id] = true;
            }
        })
        return match_map;
    } 

    get category__elaboration() { 
        return (
            parse_category_description(this).elaboration
        );
    } 

    get_search_result({full_text_search_value, categories_resources}) { 
        assert(this.is_category);

        const need = this;

        const missing_words__per_text = this.get_missing_words(full_text_search_value, {per_text: true});

        const need__missing_words = (
            missing_words__per_text[0]
            .filter(missing_word =>
                missing_words__per_text
                .slice(1)
                .every(missing_words => missing_words.includes(missing_word))
            )
        );

        const category__resources = categories_resources[this.id];
        const resources__search_target = (
            (!category__resources || category__resources.resources_included.length===0) ? (
                []
            ) : (
                [
                    ...category__resources.resources_included,
                    ...category__resources.resources_awaiting,
                ]
            )
        );
        const counts__resources = (
            resources__search_target.length === 0 ? (
                0
            ) : (
                (
                    resources__search_target
                    .filter(resource =>
                        resource
                        .get_missing_words(full_text_search_value, {per_text: false})
                        .filter(missing_word => need__missing_words.includes(missing_word))
                        .length===0
                    )
                    .length
                ) / (
                    resources__search_target.length
                )
            )
        );
        assert(missing_words__per_text, missing_words__per_text);
        const need__sort_key = [
            ...(
                missing_words__per_text
                .map(arr => -arr.length)
            ),
            counts__resources,
        ];

        const need__hidden = counts__resources===0 && need__missing_words.length>0;

        return (
            {need__missing_words, need__sort_key, need__hidden}
        );
    } 

    get_topic_list() { 
        assert(this.is_catalog);

        timerlog({disable: false, start_timer: true, id: 'compute_topic_list'});

        const needs = this.get_needs_list();

        const topics__map = {}
        needs.forEach(need => {
            need
            .category__topics
            .forEach(tag_text => {
                topics__map[tag_text] = (topics__map[tag_text]||0)+1;
            });
        });

        let topics__arr = (
            Object.entries(topics__map)
            .map(([key, val]) => {
                return ({n: val, topic_name: key});
            })
        );

        topics__arr.sort(({n: n1}, {n: n2}) => n2 - n1);

        topics__arr = topics__arr.map(({topic_name}) => topic_name);

        timerlog({end_timer: true, id: 'compute_topic_list'});

        return topics__arr;
    } 

    get_needs_list() { 
        assert_soft(this.is_catalog);
        return (
        //  Thing.things.of_type.tag.filter(tag => tag.preview.tags.includes(this.name) && tag.is_markdown_category)
            this.child_tags
        );
    } 

    static order() { 
        return [
            'name',
        ];
    } 

    static get_by_name(name, args={}) { 
        assert(name);
        assert(name.constructor === String);
        const cache_hit = cache__tags[name] || null;
        assert_soft(cache_hit || args.can_be_null, name);
        const tag = cache_hit || super.get_by_props({name}, args);
        assert_soft(tag === cache_hit, cache_hit, tag, name);
        if( !args.can_be_removed && tag && tag.is_removed ) {
            assert_soft(args.can_be_null, name);
            return null;
        }
        return  tag;
    } 

    static retrieve_by_name(name) { 
        assert(name);
        return super.retrieve_by_props({name});
    } 

    static retrieve_meta_list(args) { 
        const name = Tag.get_meta_list_name(args);
        return this.retrieve_categories_and_resources(name);
    } 

    static retrieve_categories_and_resources(name) { 
        assert(name);
        const filter_props = {preview: {tags: [name]}, is_removed: false};
        const result_fields = Array.from(new Set([...Tag.result_fields, ...Resource.result_fields]));
        return Thing.retrieve_things(filter_props, {result_fields});
    } 

    static get result_fields() { 
        return super.result_fields.concat([
            'name',
            'category_description',
            'category_order',
            'title',
            'entries_type',
            'referred_tag_markdown_list',
            'parent_category',
            'markdown_list__github_full_name',
        ]);
    } 

    static find_need_by_human_id({catalog, human_id}) { 
        if( !assert_soft(catalog.is_catalog) ) return undefined;
        if( !assert_soft(human_id) ) return undefined;

        return (
            catalog
            .child_tags
            .find(tag => {
                if( ! assert_soft(tag.is_category) ) {
                    return false;
                }
                return tag.category__human_id === human_id;
            })
        );
    } 
};

function parse_category_description(category) { 
    assert(category.is_category);

    const text = category.category_description;

    const lines = trim_new_lines(text||'').split('\n');

    let desc = null;
    let elaboration = null;
    let topics = [];

    lines.forEach((line, i) => {
        if( ! desc ) {
            desc = line;
            return;
        }
        if( i === lines.length-1 ) {
            const topics_ = parse_topics(line);
            if( topics_ ) {
                topics = topics_;
                return;
            }
        }
        if( elaboration === null ) {
            elaboration = line;
        }
        elaboration += '\n'+line;
    });

    elaboration = trim_new_lines(elaboration);

    return ({
        desc,
        elaboration,
        topics,
    });

    function trim_new_lines(str) {
        if( ! str ) {
            return str;
        }
        return (
            str
            .replace(/^(\n)+/, '')
            .replace(/(\n)+$/, '')
        );
    }

    function topic_regex() {
        return /\\\[[a-z0-9][a-z0-9\-]*[a-z0-9]\\\]/g;
    }

    function parse_topics(line) {
        if( !assert_soft(line) ) return null;
        if( !assert_soft(line.constructor===String) ) return null;

        let line_ = line;

        const hits = line.match(topic_regex());

        if( ! hits ) {
            return null;
        }

        assert(hits.length>0);

        const topics = new Set();

        hits.forEach(tag_text => {
            line_ = line_.replace(tag_text, '');
            tag_text = tag_text.slice(2, -2);
            topics.add(tag_text);
        });

        line_ = line_.replace(/\s/g, '');

        if( line_ !== '' ) {
            assert_soft(false, line);
            return null;
        }

        return Array.from(topics);
    }

} 

Tag.type = 'tag'; // UglifyJS2 mangles class name
export default Tag;
