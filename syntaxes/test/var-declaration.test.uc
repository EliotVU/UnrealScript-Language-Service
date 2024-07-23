// SYNTAX TEST "source.uc" "var testcase"

    var ( Category, Category ) const Type Variable, Variable ;
//  ^^^ meta.definition.variable.uc storage.type.variable.uc
//      ^ punctuation.parenthesis.open.uc
//        ^^^^^^^^ string.unquoted.uc
//                ^ punctuation.separator.category.uc
//                  ^^^^^^^^ string.unquoted.uc
//                           ^ punctuation.parenthesis.close.uc
//                             ^^^^^ storage.modifier.uc
//                                   ^^^^ entity.name.type.uc
//                                        ^^^^^^^^ variable.uc
//                                                  ^^^^^^^^ variable.uc

var Type Variable, ;
//!!                 ^ punctuation.semicolon.uc
