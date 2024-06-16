// SYNTAX TEST "source.uc" "class testcase"

// My UnrealScript class file
// < comment.line.double-slash.uc

class Class
// <----- meta.class.uc
//    ^^^^^ entity.name.type.class.uc

// Comment
// < comment.line.double-slash.uc

    extends Package.Class
//  ^^^^^^^ storage.modifier.extends.uc
//          ^^^^^^^ entity.other.inherited-class.uc
//                  ^^^^^ entity.other.inherited-class.uc
    within Package.Class
//  ^^^^^^ storage.modifier.within.uc
//         ^^^^^^^ entity.other.inherited-class.uc
//                 ^^^^^ entity.other.inherited-class.uc

    native ( Prefix )
//  ^^^^^^ storage.modifier.uc
//         ^ punctuation.parenthesis.open.uc
//           ^^^^^^ string.unquoted.uc
//                  ^ punctuation.parenthesis.close.uc

    dependson ( Class, Class )
//  ^^^^^^^^^ storage.modifier.uc
//            ^ punctuation.parenthesis.open.uc
//              ^^^^^ entity.name.type.uc
//                     ^^^^^ entity.name.type.uc
//                           ^ punctuation.parenthesis.close.uc

    classgroup ( ClassGroup, ClassGroup )
//  ^^^^^^^^^^ storage.modifier.uc
//             ^ punctuation.parenthesis.open.uc
//               ^^^^^^^^^^ string.unquoted.uc
//                           ^^^^^^^^^^ string.unquoted.uc
//                                      ^ punctuation.parenthesis.close.uc

    customkeyword
//  ^^^^^^^^^^^^^ storage.modifier.undetermined.uc

;
// <- punctuation.semicolon.uc
