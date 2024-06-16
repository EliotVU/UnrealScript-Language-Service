// SYNTAX TEST "source.uc" "const testcase"

const Const = sizeof ( Class )
// <----- storage.type.constant.uc
//    ^^^^^ variable.other.constant.uc
//          ^ keyword.operator.assignment.uc
//            ^^^^^^ keyword.constant.uc
//                   ^ punctuation.parenthesis.open.uc
//                     ^^^^^ entity.name.type.class.uc
//                           ^ punctuation.parenthesis.close.uc

// comment
// < comment.line.double-slash.uc

        ;
//      ^ punctuation.terminator.statement.uc
