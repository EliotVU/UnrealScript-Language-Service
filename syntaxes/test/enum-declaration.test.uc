// SYNTAX TEST "source.uc" "enum testcase"

enum Enum
// <---- meta.enum.declaration.uc storage.type.enum.uc
//   ^^^^ entity.name.type.enum.uc

// Comment
// < comment.line.double-slash.uc

{
// <- meta.enum.declaration.uc meta.block.uc punctuation.definition.block.uc

// Comment
// < comment.line.double-slash.uc

    EnumTag,
//  ^^^^^^^ variable.other.enummember.uc

    EnumTag
//  ^^^^^^^ variable.other.enummember.uc

}
// <- meta.enum.declaration.uc meta.block.uc punctuation.definition.block.uc

;
