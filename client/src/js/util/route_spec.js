import crossroads from 'crossroads';
import assert_hard from 'assertion-soft/hard';
import assert_soft from 'assertion-soft';

export default function route_spec(param) {
    assert_hard(param.constructor===Object, param);
    assert_hard(param.path_is_matching.constructor===Function, param);
    assert_hard(param.interpolate_path.constructor===Function, param);
    assert_hard(param.get_route_pattern.constructor===Function, param);
    assert_hard(param.get_route_params.constructor===Function, param);

    return param;
};

route_spec.from_crossroads_spec = function(route_string) {
    assert_soft(route_string && route_string.constructor===String, route_string);
    const crossroad_route = crossroads.addRoute(route_string);
    return (
        route_spec({
            path_is_matching: ({pathname}) => {
                assert_soft(pathname && pathname.constructor===String || pathname==='', pathname);
                return crossroad_route.match(pathname);
            },
            interpolate_path: args => crossroad_route.interpolate(args),
            get_route_pattern: () => crossroad_route._pattern,
            get_route_params: ({pathname}) => {
                assert_soft(pathname && pathname.constructor===String || pathname==='', pathname);
                return crossroad_route._getParamsObject(pathname);
            },
        })
    );
};
