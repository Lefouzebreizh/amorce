// Fichier racine Gradle du projet Android — `allprojects`, la relocalisation du
// dossier de construction, et la tâche `clean`. Rien d'autre : la configuration
// de l'application vit dans `app/build.gradle.kts`, et c'est là que doit aller
// tout ce qui parle de `namespace`, de `defaultConfig` ou de `buildTypes`.
//
// Restauré le 11/09/2026 dans son état d'avant `cd732d8` (08/09), qui l'avait
// écrasé par une copie de la configuration d'application **tronquée à la ligne
// 47**, au milieu d'un commentaire : ni corps de bloc, ni accolade fermante.
// Le projet ne compilait plus — « Expecting '}' » — et `look-and-find.yml` est
// resté rouge trois jours, sur `main` et donc sur toutes les PR du dépôt.
//
// Ce qui est perdu avec ce retour : la configuration de signature de release
// que `cd732d8` voulait ajouter. Elle n'a **jamais compilé une seule fois**,
// donc rien de fonctionnel ne disparaît — mais elle reste à faire, et sa place
// est dans `app/build.gradle.kts`, sur une machine qui peut lancer un build
// Android pour le vérifier.
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
