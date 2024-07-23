// SYNTAX TEST "source.uc" "struct testcase"

struct {ExportType} native Struct
// <------ meta.struct.declaration.uc storage.type.struct.uc
//                  ^^^^^^ storage.modifier.uc
//                         ^^^^^^ entity.name.type.struct.uc

// Comment
// < comment.line.double-slash.uc

    extends Class.Struct
//  ^^^^^^^ storage.modifier.extends.uc
//          ^^^^^ entity.other.inherited-class.uc
//                ^^^^^^ entity.other.inherited-class.uc

{
// <- meta.struct.declaration.uc meta.block.uc punctuation.definition.block.uc

// Comment
// < comment.line.double-slash.uc

    struct Struct
//  ^^^^^^ meta.struct.declaration.uc storage.type.struct.uc
//         ^^^^^^ entity.name.type.struct.uc
    {

    }

    ;

    var Type Variable ;
//  ^^^ meta.definition.variable.uc storage.type.variable.uc
//      ^^^^ entity.name.type.uc
//           ^^^^^^^^ variable.uc

    structcpptext
//  ^^^^^^^^^^^^^ keyword.other.cpptext.uc

// Comment
// < comment.line.double-slash.uc

    {
//!!  ^ punctuation.curlybrace.open.uc

//!! < meta.embedded.block.cpp.uc

        void* fn();
//!!      ^ meta.function.definition.cpp

    }
//!!  ^ punctuation.curlybrace.close.uc

    structdefaultproperties
//  ^^^^^^^^^^^^^^^^^^^^^^^ keyword.other.structdefaultproperties.uc

// Comment
// < comment.line.double-slash.uc

    {
//  ^ meta.block.uc punctuation.curlybrace.open.uc

    }
//  ^ meta.block.uc punctuation.curlybrace.close.uc

}
// <- meta.struct.declaration.uc meta.block.uc punctuation.definition.block.uc

;
