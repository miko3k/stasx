module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-stylus');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-preprocess');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-cache-bust');
    grunt.loadNpmTasks('grunt-http-server');

    var robotoPath = 'node_modules/roboto-npm-webfont/fonts/'
    var faPath = 'node_modules/fa-stylus/fonts/'
    var fontFileSet = function(dest) {
        return {
            src: [ robotoPath + '*', '!' + robotoPath + '*italic*', faPath + '*'],
            dest: dest,
            filter: "isFile",
            expand: true,
            flatten: true
        }
    }

    grunt.initConfig({
        dir: {
            "target": "target",
            "debug": "<%= dir.target %>/debug",
            "release": "<%= dir.target %>/release",
            "test": "<%= dir.target %>/test",
            "tmp": "<%= dir.target %>/build"
        },
        clean: {
            "all": [ "<%= dir.target %>" ],
            "release": [ "<%= dir.release %>" ],
        },
        stylus: {
            debug: {
                files: { '<%=dir.debug%>/style.css': 'styl/style.styl' },
                options: {
                    "compress": false
                }
            },
            release: {
                files: { '<%=dir.release%>/style.css': 'styl/style.styl' },
                options: {
                    "compress": true
                }
            },
        },
        copy: {
            test: {
                src: [ "html/test.html"],
                dest: "<%=dir.test%>/index.html"
            },
            debug: {
                files: [
                    fontFileSet("<%=dir.debug%>/fonts/"),
                    { 'src': 'node_modules/zxcvbn/dist/zxcvbn.js', 'dest': '<%=dir.debug%>/zxcvbn.js' }
                ]
            },
            release: {
                files: [
                    fontFileSet("<%=dir.release%>/fonts/"),
                    { 'src': 'node_modules/zxcvbn/dist/zxcvbn.js', 'dest': '<%=dir.release%>/zxcvbn.js' }
                ]
            }
        },
        preprocess: {
            debug: {
                options: {
                    context: {
                        DEBUG: true
                    }
                },
                files: {
                    "<%=dir.debug%>/index.html": ["html/web.html"]
                }
            },
            release: {
                options: {
                    context: { }
                },
                files: {
                    "<%=dir.tmp%>/index.html": ["html/web.html"]
                }
            }
        },
        htmlmin: {
            release: {
                options: {
                    removeComments: true,
                    collapseWhitespace: true
                },
                files: {
                    '<%=dir.release%>/index.html': '<%=dir.tmp%>/index.html',
                }
            }
        },
        browserify: {
            debug: {
                files: { "<%=dir.debug%>/script.js": [ "js/browser.js" ] },
                options: { }
            },
            release: {
                files: { "<%=dir.tmp%>/script.js": [ "js/browser.js" ] },
                options: { }
            },
            test: {
                src: [ "js/tests_browser.js" ],
                dest: "<%=dir.test%>/script.js",
            }
        },
        uglify: {
            release: {
                files: {
                    "<%= dir.release %>/script.js": [ "<%= dir.tmp %>/script.js" ]
                }
            }
        },
        cacheBust: {
            // is there a way to avoid two rounds?
            // also, this must be called in correct order
            a: {
                options: {
                    baseDir: '<%=dir.release%>',
                    assets: ['fonts/*'],
                    deleteOriginals: true
                },
                src: ['<%=dir.release%>/style.css']
            },
            b: {
                options: {
                    baseDir: '<%=dir.release%>',
                    assets: ['style.css', 'script.js', 'zxcvbn.js'],
                    deleteOriginals: true
                },
                src: ['<%=dir.release%>/index.html']
            }
        },
        watch: {
            options: {
                livereload: true,
            },
            js: {
                files: ['js/*.js'],
                tasks: ['browserify:debug'],
            },
            styl: {
                files: ['styl/*.styl'],
                tasks: ['stylus:debug'],
            },
            html: {
                files: ['html/web.html'],
                tasks: ['preprocess:debug'],
            }
        },
        'http-server': {
            'dev': {
                root: '<%=dir.debug%>',
                port: 8000,
                runInBackground: true
            }
        }
    });
    grunt.registerTask('test', ['copy:test', 'browserify:test']);
    grunt.registerTask('debug', ['stylus:debug', 'copy:debug', 'preprocess:debug', 'browserify:debug' ]);
    grunt.registerTask('release', [ 'clean:release', 'stylus:release', 'copy:release', 'preprocess:release',
        'htmlmin:release', 'browserify:release', 'uglify:release', 'cacheBust:a', 'cacheBust:b' ]);
    grunt.registerTask('server', [ 'http-server', 'watch' ]);

    grunt.registerTask('default', [ 'clean', 'test', 'debug', 'release']);
};
