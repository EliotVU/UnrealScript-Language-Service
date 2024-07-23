// SYNTAX TEST "source.uc" "defaultproperties testcase"

    defaultproperties
//  ^^^^^^^^^^^^^^^^^^^^^^^ keyword.other.defaultproperties.uc

// Comment
// < comment.line.double-slash.uc

    {
//  ^ meta.block.uc punctuation.curlybrace.open.uc

        member = expression
//      ^^^^^^ variable.other.uc
//             ^ keyword.operator.assignment.uc
//               ^^^^^^^^^^ variable.other.uc

    }
//  ^ meta.block.uc punctuation.curlybrace.close.uc
