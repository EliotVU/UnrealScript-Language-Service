// SYNTAX TEST "source.uc" "interface testcase"

// My UnrealScript interface file
// < comment.line.double-slash.uc

interface Interface
// <--------- meta.interface.uc
//        ^^^^^^^^^ entity.name.type.interface.uc

// Comment
// < comment.line.double-slash.uc

    extends Package.Interface
//  ^^^^^^^ storage.modifier.extends.uc
//          ^^^^^^^ entity.other.inherited-class.uc
//                  ^^^^^^^^^ entity.other.inherited-class.uc

    editinlinenew
//  ^^^^^^^^^^^^^ storage.modifier.uc

    nativeonly ( Prefix )
//  ^^^^^^^^^^ storage.modifier.uc
//             ^ punctuation.parenthesis.open.uc
//               ^^^^^^ string.unquoted.uc
//                      ^ punctuation.parenthesis.close.uc

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

    customkeyword
//  ^^^^^^^^^^^^^ storage.modifier.undetermined.uc

;
// <- punctuation.semicolon.uc
