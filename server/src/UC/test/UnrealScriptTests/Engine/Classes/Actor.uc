class Actor extends Core.Object
    native;

// To test coercing of the return type to match the argument type that is passed to the first `spawnClass` parameter.
native final function coerce Actor Spawn(Class<Actor> spawnClass);
