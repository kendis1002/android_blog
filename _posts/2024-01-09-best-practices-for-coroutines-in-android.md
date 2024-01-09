---
layout: post
current: post
cover: assets/images/viewmodelscope.png
navigation: True
title: Best practices về coroutine trong Android
date: 2023-12-08 10:18:00
tags: coroutine
class: post-template
subclass: 'post'
author: kendis
---

Dưới đây sẽ là một số best practices có tác động tích cực bằng cách làm cho ứng dụng của bạn trở nên có khả năng mở rộng và test tốt hơn khi sử dụng **coroutines**.

## Inject Dispatchers
Không nên hard code **Dispatchers** khi tạo **coroutines** mới hoặc gọi với **withContext**.

```kotlin
// DO inject Dispatchers
class NewsRepository(
    private val defaultDispatcher: CoroutineDispatcher = Dispatchers.Default
) {
    suspend fun loadNews() = withContext(defaultDispatcher) { /* ... */ }
}

// DO NOT hardcode Dispatchers
class NewsRepository {
    // DO NOT use Dispatchers.Default directly, inject it instead
    suspend fun loadNews() = withContext(Dispatchers.Default) { /* ... */ }
}
```

Mô hình dependency injection này làm cho việc test dễ dàng hơn vì bạn có thể thay thế các dispatchers đó trong các unit test và  instrumentation test bằng một test dispatcher để làm cho các bài test của bạn trở nên xác định hơn.

> Lưu ý: Thuộc tính **viewModelScope** của các class **ViewModel** được hard code với Dispatchers.Main. Thay thế nó trong bài test bằng cách gọi **Dispatchers.setMain** và truyền vào một test dispatcher.

## Các function suspend phải được an toàn khi gọi từ main thread.

Các function suspend nên được an toàn trên main thread, có nghĩa là chúng an toàn khi gọi từ main thread. Nếu một class đang thực hiện các hoạt động chặn lâu dài trong một coroutine, nó chịu trách nhiệm di chuyển thực thi khỏi main thread bằng cách sử dụng **withContext**. Điều này áp dụng cho tất cả các class trong ứng dụng của bạn, bất kể phần của kiến trúc mà class đó thuộc về.

```kotlin
class NewsRepository(private val ioDispatcher: CoroutineDispatcher) {

    // As this operation is manually retrieving the news from the server
    // using a blocking HttpURLConnection, it needs to move the execution
    // to an IO dispatcher to make it main-safe
    suspend fun fetchLatestNews(): List<Article> {
        withContext(ioDispatcher) { /* ... implementation ... */ }
    }
}

// This use case fetches the latest news and the associated author.
class GetLatestNewsWithAuthorsUseCase(
    private val newsRepository: NewsRepository,
    private val authorsRepository: AuthorsRepository
) {
    // This method doesn't need to worry about moving the execution of the
    // coroutine to a different thread as newsRepository is main-safe.
    // The work done in the coroutine is lightweight as it only creates
    // a list and add elements to it
    suspend operator fun invoke(): List<ArticleWithAuthor> {
        val news = newsRepository.fetchLatestNews()

        val response: List<ArticleWithAuthor> = mutableEmptyList()
        for (article in news) {
            val author = authorsRepository.getAuthor(article.author)
            response.add(ArticleWithAuthor(article, author))
        }
        return Result.Success(response)
    }
}
```

Pattern này làm cho ứng dụng của bạn trở nên có khả năng mở rộng hơn, vì các class gọi các function suspend không cần phải lo lắng về **Dispatcher** nào được sử dụng cho loại công việc nào. Trách nhiệm này thuộc về class thực hiện công việc.

## ViewModel nên tạo các coroutine

Các class **ViewModel** nên được ưu tiên tạo coroutines thay vì đưa ra các function suspend để thực hiện business logic. Các function suspend trong **ViewModel** có thể hữu ích nếu thay vì đưa **state** bằng cách sử dụng một luồng data, chỉ cần phát ra một giá trị duy nhất.

```kotlin
// DO create coroutines in the ViewModel
class LatestNewsViewModel(
    private val getLatestNewsWithAuthors: GetLatestNewsWithAuthorsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<LatestNewsUiState>(LatestNewsUiState.Loading)
    val uiState: StateFlow<LatestNewsUiState> = _uiState

    fun loadNews() {
        viewModelScope.launch {
            val latestNewsWithAuthors = getLatestNewsWithAuthors()
            _uiState.value = LatestNewsUiState.Success(latestNewsWithAuthors)
        }
    }
}

// Prefer observable state rather than suspend functions from the ViewModel
class LatestNewsViewModel(
    private val getLatestNewsWithAuthors: GetLatestNewsWithAuthorsUseCase
) : ViewModel() {
    // DO NOT do this. News would probably need to be refreshed as well.
    // Instead of exposing a single value with a suspend function, news should
    // be exposed using a stream of data as in the code snippet above.
    suspend fun loadNews() = getLatestNewsWithAuthors()
}
```

Các Views không nên trực tiếp kích hoạt bất kỳ coroutine nào để thực hiện business logic. Thay vào đó, chuyển trách nhiệm đó cho **ViewModel**. Điều này làm cho business logic của bạn dễ test hơn vì object ViewModel có thể được unit test, thay vì sử dụng các bài test instrumentation cần thiết để test views.

Ngoài ra, coroutine của bạn sẽ tự động tồn tại qua các thay đổi cấu hình nếu công việc được bắt đầu trong **viewModelScope**. Nếu bạn tạo coroutines bằng cách sử dụng **lifecycleScope** thay thế, bạn sẽ phải xử lý điều đó một cách thủ công. Nếu coroutine cần tồn tại qua scope của **ViewModel**, hãy xem phần [Tạo coroutines trong layer business và data](https://developer.android.com/kotlin/coroutines/coroutines-best-practices#create-coroutines-data-layer).

> Lưu ý: Views nên kích hoạt coroutines để thực hiện logic liên quan đến UI. Ví dụ, tải một hình ảnh từ Internet hoặc định dạng một string.

## Đừng xuất mutable type

Ưu tiên việc xuất các kiểu không thay đổi (**immutable**) cho các class khác. Như vậy, tất cả các thay đổi đối với kiểu có thể thay đổi (**mutable**) sẽ được tập trung trong một class, giúp dễ dàng debug khi có vấn đề xảy ra.

```kotlin
// DO expose immutable types
class LatestNewsViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(LatestNewsUiState.Loading)
    val uiState: StateFlow<LatestNewsUiState> = _uiState

    /* ... */
}

class LatestNewsViewModel : ViewModel() {

    // DO NOT expose mutable types
    val uiState = MutableStateFlow(LatestNewsUiState.Loading)

    /* ... */
}
```

## Data and business layer nên xuất các function suspend và flows.

Các class trong data and business layer thông thường xuất các function để thực hiện cuộc gọi một lần hoặc để được thông báo về thay đổi dữ liệu theo thời gian. Các class trong những class đó nên xuất các hàm **suspend để thực hiện cuộc gọi một lần** và **Flow để thông báo về thay đổi dữ liệu**.

```kotlin
// Classes in the data and business layer expose
// either suspend functions or Flows
class ExampleRepository {
    suspend fun makeNetworkRequest() { /* ... */ }

    fun getExamples(): Flow<Example> { /* ... */ }
}
```

Best practice này làm nơi gọi, thường là presentation layer có khả năng kiểm soát vòng đời và việc thực thi của công việc diễn ra trong những class đó, và có thể hủy bỏ khi cần thiết.

## Tạo coroutine ở trong business và data layer

Đối với các class ở data class hoặc business class cần tạo coroutines vì các lý do khác nhau, có các lựa chọn khác nhau.

Nếu công việc cần thực hiện trong những coroutine này chỉ quan trọng khi người dùng hiện diện trên màn hình hiện tại, nó nên tuân theo vòng đời của người gọi. Trong hầu hết các trường hợp, người gọi sẽ là ViewModel, và cuộc gọi sẽ bị hủy bỏ khi người dùng chuyển đi khỏi màn hình và ViewModel bị xóa. Trong trường hợp này, nên sử dụng **coroutineScope** hoặc **supervisorScope**.

```kotlin
class GetAllBooksAndAuthorsUseCase(
    private val booksRepository: BooksRepository,
    private val authorsRepository: AuthorsRepository,
) {
    suspend fun getBookAndAuthors(): BookAndAuthors {
        // In parallel, fetch books and authors and return when both requests
        // complete and the data is ready
        return coroutineScope {
            val books = async { booksRepository.getAllBooks() }
            val authors = async { authorsRepository.getAllAuthors() }
            BookAndAuthors(books.await(), authors.await())
        }
    }
}
```

Nếu công việc cần thực hiện liên quan đến việc mở ứng dụng và công việc không liên quan đến màn hình cụ thể, thì công việc đó nên tồn tại qua vòng đời của người gọi. Đối với tình huống này, nên sử dụng một **CoroutineScope** bên ngoài như được giải thích trong bài viết blog [Coroutines & Patterns for work that shouldn’t be cancelled](https://medium.com/androiddevelopers/coroutines-patterns-for-work-that-shouldnt-be-cancelled-e26c40f142ad).

```kotlin
class ArticlesRepository(
    private val articlesDataSource: ArticlesDataSource,
    private val externalScope: CoroutineScope,
) {
    // As we want to complete bookmarking the article even if the user moves
    // away from the screen, the work is done creating a new coroutine
    // from an external scope
    suspend fun bookmarkArticle(article: Article) {
        externalScope.launch { articlesDataSource.bookmarkArticle(article) }
            .join() // Wait for the coroutine to complete
    }
}
```

**externalScope** nên được tạo và quản lý bởi một class tồn tại lâu hơn màn hình hiện tại, nó có thể được quản lý bởi class **Application** hoặc một **ViewModel** có scope liên quan đến navigation graph.

## Tránh sử dụng GlobalScope

Điều này tương tự như thực hành tốt Inject Dispatchers. Bằng cách sử dụng **GlobalScope**, bạn đang hard code CoroutineScope mà một class sử dụng, mang theo một số nhược điểm:

* Thúc đẩy việc hard code giá trị. Nếu bạn hard code GlobalScope, bạn có thể cũng đang hard code Dispatchers.

* Làm cho việc test trở nên rất khó khăn vì code của bạn được thực thi trong một scope không kiểm soát, bạn sẽ không thể kiểm soát quá trình thực thi của nó.

* Bạn không thể có một **CoroutineContext** chung để thực thi cho tất cả các coroutines được xây dựng vào scope chính nó.

Thay vào đó, hãy xem xét việc tiêm một **CoroutineScope** cho công việc cần tồn tại qua scope hiện tại. Kiểm tra phần [Tạo coroutines trong class kinh doanh và dữ liệu](https://developer.android.com/kotlin/coroutines/coroutines-best-practices#create-coroutines-data-layer) để tìm hiểu thêm về chủ đề này.

```kotlin
// DO inject an external scope instead of using GlobalScope.
// GlobalScope can be used indirectly. Here as a default parameter makes sense.
class ArticlesRepository(
    private val articlesDataSource: ArticlesDataSource,
    private val externalScope: CoroutineScope = GlobalScope,
    private val defaultDispatcher: CoroutineDispatcher = Dispatchers.Default
) {
    // As we want to complete bookmarking the article even if the user moves
    // away from the screen, the work is done creating a new coroutine
    // from an external scope
    suspend fun bookmarkArticle(article: Article) {
        externalScope.launch(defaultDispatcher) {
            articlesDataSource.bookmarkArticle(article)
        }
            .join() // Wait for the coroutine to complete
    }
}

// DO NOT use GlobalScope directly
class ArticlesRepository(
    private val articlesDataSource: ArticlesDataSource,
) {
    // As we want to complete bookmarking the article even if the user moves away
    // from the screen, the work is done creating a new coroutine with GlobalScope
    suspend fun bookmarkArticle(article: Article) {
        GlobalScope.launch {
            articlesDataSource.bookmarkArticle(article)
        }
            .join() // Wait for the coroutine to complete
    }
}
```

Tìm hiểu thêm về GlobalScope và các lựa chọn thay thế trong bài blog [Coroutines & Patterns for work that shouldn’t be cancelled](https://medium.com/androiddevelopers/coroutines-patterns-for-work-that-shouldnt-be-cancelled-e26c40f142ad).

## Làm coroutine của bạn có thể huỷ được

Sự hủy bỏ trong coroutines là hợp tác, có nghĩa là khi một **Job** của coroutine bị hủy bỏ, coroutine đó không bị hủy bỏ cho đến khi nó tạm dừng hoặc kiểm tra để biết có hủy bỏ hay không. Nếu bạn thực hiện các suspend action trong một coroutine, hãy đảm bảo rằng coroutine đó có thể bị hủy bỏ.

Ví dụ, nếu bạn đang đọc nhiều tệp từ đĩa, trước khi bắt đầu đọc mỗi tệp, kiểm tra xem coroutine có bị hủy bỏ hay không. Một cách để kiểm tra hủy bỏ là bằng cách gọi function **ensureActive**.

```kotlin
someScope.launch {
    for(file in files) {
        ensureActive() // Check for cancellation
        readFile(file)
    }
}
```
Tất cả các suspend function từ **kotlinx.coroutines** như **withContext** và **delay** đều có thể bị hủy bỏ. Nếu **coroutine** của bạn gọi chúng, bạn không cần phải thực hiện bất kỳ công việc bổ sung nào.

Để biết thêm thông tin về việc hủy bỏ trong coroutines, hãy kiểm tra bài blog [Cancellation in coroutines](https://medium.com/androiddevelopers/cancellation-in-coroutines-aa6b90163629).

## Cẩn thận với exception

Exception không được xử lý được throw ra trong coroutines có thể làm cho ứng dụng của bạn bị crash. Nếu có khả năng xảy ra exception, hãy bắt chúng trong thân của bất kỳ coroutine nào được tạo với **viewModelScope** hoặc **lifecycleScope**.

```kotlin
class LoginViewModel(
    private val loginRepository: LoginRepository
) : ViewModel() {

    fun login(username: String, token: String) {
        viewModelScope.launch {
            try {
                loginRepository.login(username, token)
                // Notify view user logged in successfully
            } catch (exception: IOException) {
                // Notify view login attempt failed
            }
        }
    }
}
```

Để biết thêm thông tin, hãy kiểm tra bài viết blog [Exceptions in coroutines](https://medium.com/androiddevelopers/exceptions-in-coroutines-ce8da1ec060c) hoặc xem phần [xử lý ngoại lệ trong coroutines](https://kotlinlang.org/docs/exception-handling.html) trong tài liệu Kotlin.

## Thêm về coroutine

Để xem thêm về coroutine, nhấn ở [đây](https://developer.android.com/kotlin/coroutines/additional-resources).
