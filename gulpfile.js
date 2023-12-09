const gulp = require('gulp');
const gutil = require('gulp-util');
const livereload = require('gulp-livereload');
const postcss = require('gulp-postcss');
const sourcemaps = require('gulp-sourcemaps');
const zip = require('gulp-zip');

// postcss plugins
const autoprefixer = require('autoprefixer');
const colorFunction = require('postcss-color-function');
const cssnano = require('cssnano');
const customProperties = require('postcss-custom-properties');
const easyimport = require('postcss-easy-import');

const swallowError = function swallowError(error) {
    gutil.log(error.toString());
    gutil.beep();
    this.emit('end');
};

const nodemonServerInit = function () {
    livereload.listen(1234);
};

function css() {
    const processors = [
        easyimport,
        customProperties,
        colorFunction(),
        autoprefixer({ browsers: ['last 2 versions'] }),
        cssnano()
    ];

    return gulp.src('assets/css/*.css')
        .pipe(sourcemaps.init())
        .pipe(postcss(processors).on('error', swallowError))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('assets/built/'))
        .pipe(livereload());
}

function build(done) {
    nodemonServerInit();
    done();
}

function watch() {
    gulp.watch('assets/css/**', gulp.series('css'));
}

function zipTask() {
    const targetDir = 'dist/';
    const themeName = require('./package.json').name;
    const filename = themeName + '.zip';

    return gulp.src([
        '**',
        '!node_modules', '!node_modules/**',
        '!dist', '!dist/**'
    ])
        .pipe(zip(filename))
        .pipe(gulp.dest(targetDir));
}

gulp.task('css', css);
gulp.task('build', gulp.series('css', build));
gulp.task('watch', gulp.series('build', watch));
gulp.task('zip', gulp.series('css', zipTask));
gulp.task('default', gulp.series('build', watch));