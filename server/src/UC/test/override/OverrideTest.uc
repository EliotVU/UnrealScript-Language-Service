class OverrideTest extends OverrideBase;

// Should override OverrideBase.MyMethod
function MyMethod();

// Should not override OverrideBase.MyPrivateMethod
function MyPrivateMethod();

// Should override OverrideBase.MyState
state MyState {}

// Should not override
state MyNewState extends MyState {}