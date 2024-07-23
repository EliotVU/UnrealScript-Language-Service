// SYNTAX TEST "source.uc" "state testcase"

simulated function Function () ;

simulated auto
// <--------- storage.modifier.uc
//        ^^^^ storage.modifier.uc
               state () State extends State
//             ^^^^^ meta.state.declaration.uc storage.type.state.uc
//                      ^^^^^ entity.name.type.state.uc
//                            ^^^^^^^ storage.modifier.extends.uc
//                                    ^^^^^ entity.other.inherited-class.uc

// Comment
// < comment.line.double-slash.uc

{
// <- meta.state.declaration.uc meta.block.uc punctuation.definition.block.uc

    local Type Local ;
//  ^^^^^ meta.definition.variable.uc storage.type.variable.uc
//        ^^^^ entity.name.type.uc
//             ^^^^^ variable.uc

    ignores Function, Function ;
//  ^^^^^^^ keyword.other.ignores.uc
//          ^^^^^^^^ entity.name.function.uc
//                    ^^^^^^^^ entity.name.function.uc
//                             ^ punctuation.semicolon.uc

    function Function () ;
//  ^^^^^^^^ keyword.other.function.uc

    Label :
//  ^^^^^ entity.name.label.uc
        Expression ;
//      ^^^^^^^^^^ variable.other.uc
//                 ^ punctuation.terminator.statement.uc
        stop ;
//      ^^^^ keyword.control.flow.uc
//           ^ punctuation.terminator.statement.uc
}
// <- meta.state.declaration.uc meta.block.uc punctuation.definition.block.uc
