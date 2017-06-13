const validator = require('validator');

module.exports = (props, {Thing, type_is_optional}) => {
    const prefix = "things loading properties criteria";
    if( Object.keys(props) === 0 ) {
        throw new Thing.ValidationError(prefix+" are missing");
    }
    if( "id" in props ) {
        if( ! props.id || props.id.constructor!==String || ! validator.isUUID(props.id) ) {
            throw new Thing.ValidationError(prefix+"'s `id` is not a UUID: `"+props.id+"`\n"+JSON.stringify(props, null, 2));
        }
        return;
    }
    if( ! props.type && !type_is_optional ) {
        throw new Thing.ValidationError(prefix+" is missing `type`");
        return;
    }
    Object.entries(props)
    .forEach(([prop, val]) => {
        if( val===undefined ) {
            throw new Thing.ValidationError(prefix+" has `"+prop+"` equals to `undefined` which is forbidden");
        }
    });
};
