import assert from 'assert';
import Thing from './thing';
import Resource from './resource';
import Promise from 'bluebird';
import clean_sentence from 'clean-sentence'

Promise.longStackTraces();


const child_tags__cache = {};

class Tag extends Thing {
    constructor(...args) { 
        super(
            ...args );
    } 

    get description() { 
        let desc =
            this.markdown_list__description ||
            this.definition;
        desc = clean_sentence(desc||'');
        return desc;
    } 

    get display_title() { 
        return (
            this.title ||
            (this.markdown_list__data||{}).text ||
            this.name
        );
    } 

    get display_title__strip_awesome() { 
        return (
            this.display_title.replace(/^awesome /i,'')
        )
    } 

    get child_tags() { 
        assert(this.id);
        return (
            child_tags__cache[this.id] || (
                child_tags__cache[this.id] = Thing.things.all.filter(t => (t.parent_tag||{}).id === this.id)
            )
        );
    } 

    get descendant_tags() { 
        assert(this.id);
        return (
            this.child_tags
            .map(child_tag => [child_tag].concat(child_tag.descendant_tags))
            .reduce((prev,curr) => prev.concat(curr), [])
        );
    } 

    get markdown_list_tag() { 
        assert(this.is_markdown_category || this.is_markdown_list);
        if( this.is_markdown_list ) {
            return this;
        }
        assert(this.parent_tag);
        return this.parent_tag.markdown_list_tag;
    } 

    get ancestor_tags() { 
        if( ! this.parent_tag ) {
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
        return this.parent_tag ?
            this.parent_tag.depth+1 : 0;
    } 

    get resource_requests() { 
        assert( this.is_markdown_list );
        assert( this.markdown_list__data );
        return (
            Resource.list_things({tags: [this], newest: true})
            .filter(resource =>
                resource
                .tagrequests
                .some(tag => tag.markdown_list_tag === this)
            )
        );
    } 

    get is_markdown_list() { 
        return (
            !! this.markdown_list__data
        );
    } 

    get is_markdown_category() { 
        const parent_tag = this.parent_tag;
        if( ! parent_tag ) {
            return false;
        }
        return parent_tag.is_markdown_list || parent_tag.is_markdown_category;
    } 

    static order() { 
        return [
            'name',
        ];
    } 

    static list_things ({only_root=false, }={}) { 
        const filter_function = !only_root ? null : tags => tags.filter(tag => !tag.parent_tag);
        return super.list_things({
            filter_function,
        });
    } 

    static get_by_name(name) { 
        assert(name);
        assert(name.constructor === String);
        return super.get_by_props({name});
    } 

    static retrieve_by_name(name) { 
        assert(name);
        return super.retrieve_by_props({name});
    } 

    static get result_fields() { 
        return [
            'id',
            'type',
            'name',
            'definition',
            'markdown_list__data',
            'markdown_list__github_full_name',
            'markdown_list__description',
        ];
    } 
};

Tag.type = 'tag'; // UglifyJS2 mangles class name
export default Tag;
