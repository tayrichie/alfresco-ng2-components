module.exports = function(grunt) {

    grunt.initConfig({
        'connect': {
            demo: {
                options: {
                    open: true,
                    keepalive: true
                }
            }
        },
        'gh-pages': {
            options: {
                clone: 'bower_components/alfresco-file-list'
            },
            src: [
                'bower_components/**/*',
                '!bower_components/alfresco-file-list/**/*',
                'demo/*', 'src/*', 'index-demo.html'
            ]
        },
        'replace': {
            example: {
                src: ['src/*'],
                dest: 'dist/',
                replacements: [{
                    from: 'bower_components',
                    to: '..'
                }]
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-gh-pages');
    grunt.loadNpmTasks('grunt-text-replace');

    grunt.registerTask('build',  ['replace']);
    grunt.registerTask('deploy', ['gh-pages']);
    grunt.registerTask('server', ['connect']);

};
