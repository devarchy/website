// - babel repl of this mixin code; https://babeljs.io/repl/#?experimental=true&evaluate=true&loose=false&spec=false&code=const%20CompMixin%20%3D%20%7B%0A%20%20get%20propi()%7Breturn%201%7D%2C%0A%20%20fct()%7Breturn%202%7D%0A%7D%0A%0A%40mixin(CompMixin)%0Aclass%20MC%20%7B%0A%20%20constructor()%7B%7D%0A%7D%0A%0Aconst%20m%20%3D%20new%20MC%3B%0Aconsole.log(m.fct())%3B%0Aconsole.log(m.propi)%3B%0A%0A%0Afunction%20mixin(...mixins)%20%7B%0A%20%20return%20function(cls)%7B%0A%20%20%20%20mixins.forEach(mix%20%3D%3E%20%7B%0A%20%20%20%20%20%20for(var%20p%20in%20mix)%20%7B%0A%20%20%20%20%20%20%20%20cls.prototype%5Bp%5D%20%3D%20mix%5Bp%5D%3B%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%7D)%3B%0A%20%20%7D%0A%7D%0A
// - issue using this mixin; `{get: [Symbol] () {return 1} }` doesn't seem to work with Babel/ES2015
//   - see babel repl; https://babeljs.io/repl/#?evaluate=true&presets=es2015%2Ces2015-loose%2Creact%2Cstage-0%2Cstage-1%2Cstage-2%2Cstage-3&experimental=true&loose=false&spec=false&code=var%20s1%20%3D%20Symbol()%3B%0Avar%20s2%20%3D%20Symbol()%3B%0A%0Avar%20o%20%3D%20%7B%0A%20%20get%20%5Bs1%5D%20()%20%7B%0A%20%20%20%20return%201%3B%0A%20%20%7D%2C%0A%7D%3B%0A%0Ao%5Bs2%5D%20%3D%202%3B%0A%0Aconsole.log(o%5Bs1%5D%20!%3D%3D%20undefined)%3B%0Aconsole.log(o%5Bs2%5D%20!%3D%3D%20undefined)%0Aconsole.log(Object.getOwnPropertySymbols(o).length)%3B


export default function mixin(...mixins) {
  return function(cls){
    mixins.forEach(mix => {
      // Reflect.ownKeys is union of getOwnPropertyNames and getOwnPropertySymbols
      Reflect.ownKeys(mix).forEach(p => {
        const descriptor = Object.getOwnPropertyDescriptor(mix, p);
        if( descriptor ) {
            Object.defineProperty(cls.prototype, p, descriptor);
        }
        else {
            cls.prototype[p] = mix[p];
        }
      });
    });
  }
}
