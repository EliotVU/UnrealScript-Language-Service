// SYNTAX TEST "source.uc" "replication block testcase"

replication
// <----------- keyword.other.replication.uc
// comment
// < comment.line.double-slash.uc
{
// <- meta.block.uc punctuation.curlybrace.open.uc

    reliable if ( expression )
//  ^^^^^^^^ keyword.control.flow.uc
//           ^^ keyword.control.conditional.uc
//              ^ punctuation.parenthesis.open.uc
//                ^^^^^^^^^^ variable.other.uc
//                           ^  punctuation.parenthesis.close.uc
        member, member ;
//      ^^^^^^ variable.other.member.uc
//              ^^^^^^ variable.other.member.uc
//                     ^ punctuation.terminator.statement.uc

    unreliable always if ( expression )
//  ^ keyword.control.flow.uc
//             ^ keyword.control.flow.uc
//                    ^ keyword.control.conditional.uc
//                       ^ punctuation.parenthesis.open.uc
//                         ^^^^^^^^^^ variable.other.uc
//                                    ^ punctuation.parenthesis.close.uc

        ;
//      ^ punctuation.terminator.statement.uc

}
// <- meta.block.uc punctuation.curlybrace.close.uc
