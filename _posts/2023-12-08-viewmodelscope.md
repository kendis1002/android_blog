---
layout: post
current: post
cover: assets/images/viewmodelscope.png
navigation: True
title: Coroutines đơn giản trong Android - viewModelScope
date: 2023-12-08 10:18:00
tags: coroutine
class: post-template
subclass: 'post'
author: kendis
---

Tìm hiểu mọi thứ bạn nên biết về viewModelScope

Hủy bỏ các hàm xử lý song song khi chúng không còn cần thiết có thể là một công việc dễ quên, đơn điệu và thêm rất nhiều mã boilerplate. ```viewModelScope``` góp phần vào việc làm cho việc này có tổ chức hơn bằng cách thêm một thuộc tính mở rộng vào lớp ViewModel, tự động hủy bỏ các coroutine con khi ViewModel bị hủy.

## Scopes trong ViewModels

Một ```CoroutineScope``` sẽ theo dõi tất cả các coroutine mà nó tạo ra. Do đó, nếu bạn hủy một scope, bạn sẽ hủy tất cả các coroutine mà nó đã tạo ra. Điều này là đặc biệt quan trọng nếu bạn đang chạy các coroutine trong một ViewModel. Nếu ViewModel của bạn bị hủy, tất cả công việc không đồng bộ mà nó có thể đang thực hiện phải được dừng. Nếu không, bạn sẽ lãng phí tài nguyên và có thể gây rò rỉ bộ nhớ. Nếu bạn cho rằng một số công việc không đồng bộ cụ thể nào đó nên tồn tại sau khi ViewModel bị hủy, điều này nên được thực hiện ở một tầng thấp hơn trong kiến trúc ứng dụng của bạn.

Thêm một ```CoroutineScope``` vào ViewModel của bạn bằng cách tạo một scope mới với một ```SupervisorJob```, bạn sẽ hủy ```SupervisorJob``` trong phương thức ```onCleared()```. Các coroutine được tạo ra với scope đó sẽ tồn tại cùng với việc ViewModel được sử dụng. Xem đoạn code sau:

```kotlin
class MyViewModel : ViewModel() {

    /**
     * This is the job for all coroutines started by this ViewModel.
     * Cancelling this job will cancel all coroutines started by this ViewModel.
     */
    private val viewModelJob = SupervisorJob()
    
    /**
     * This is the main scope for all coroutines launched by MainViewModel.
     * Since we pass viewModelJob, you can cancel all coroutines 
     * launched by uiScope by calling viewModelJob.cancel()
     */
    private val uiScope = CoroutineScope(Dispatchers.Main + viewModelJob)
    
    /**
     * Cancel all coroutines when the ViewModel is cleared
     */
    override fun onCleared() {
        super.onCleared()
        viewModelJob.cancel()
    }
    
    /**
     * Heavy operation that cannot be done in the Main Thread
     */
    fun launchDataLoad() {
        uiScope.launch {
            sortList() // happens on the background
            // Modify UI
        }
    }
    
    // Move the execution off the main thread using withContext(Dispatchers.Default)
    suspend fun sortList() = withContext(Dispatchers.Default) {
        // Heavy work
    }
}
```
Công việc đang diễn ra ở nền sẽ bị hủy nếu ViewModel bị hủy vì coroutine được bắt đầu bởi ```uiScope``` đó.

Nhưng như vậy có vè là rất nhiều code trong mỗi ViewModel. ```viewModelScope``` được tạo ra để đơn giản hóa tất cả điều này.

## viewModelScope sẽ làm ít mã boilerplate hơn.

[AndroidX Lifecycle phiên bản 2.1.0](https://developer.android.com/jetpack/androidx/releases/lifecycle)  giới thiệu thuộc tính mở rộng viewModelScope cho lớp ViewModel. Nó quản lý các coroutine theo cùng cách mà chúng ta đang làm trong phần trước đó. đoạn code đó đã được rút gọn thành đoạn code sau:

```kotlin
class MyViewModel : ViewModel() {
  
    /**
     * Heavy operation that cannot be done in the Main Thread
     */
    fun launchDataLoad() {
        viewModelScope.launch {
            sortList()
            // Modify UI
        }
    }
  
    suspend fun sortList() = withContext(Dispatchers.Default) {
        // Heavy work
    }
}
```

Tất cả công việc thiết lập và hủy bỏ CoroutineScope đã được thực hiện cho chúng ta sẵn. Để sử dụng nó, nhập phụ thuộc sau vào tệp build.gradle của bạn:

```gradle
implementation "androidx.lifecycle.lifecycle-viewmodel-ktx$lifecycle_version"
```

Hãy xem xét những điều đang diễn ra bên trong.

## Đào sâu vào viewModelScope

```viewModelScope``` là mã nguồn mở, công khai và được triển khai như sau:

```kotlin
private const val JOB_KEY = "androidx.lifecycle.ViewModelCoroutineScope.JOB_KEY"

val ViewModel.viewModelScope: CoroutineScope
    get() {
        val scope: CoroutineScope? = this.getTag(JOB_KEY)
        if (scope != null) {
            return scope
        }
        return setTagIfAbsent(JOB_KEY,
            CloseableCoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
    }
```

Class ViewModel có một thuộc tính ConcurrentHashSet nơi nó có thể lưu trữ bất kỳ loại đối tượng nào. CoroutineScope được lưu trữ ở đó. Nếu ta nhìn vào mã nguồn, phương thức getTag(JOB_KEY) sẽ lấy scope từ đó. Nếu scope không tồn tại, tạo một CoroutineScope mới theo cùng cách chúng ta đã làm trước đó và thêm tag vào bộ sưu tập.

Khi ViewModel được xóa, nó thực thi phương thức clear() trước khi gọi phương thức onCleared(). Trong phương thức clear(), ViewModel hủy Job của viewModelScope. 

Mã nguồn đầy đủ của ViewModel cũng có sẵn nhưng chúng ta chỉ tập trung vào các phần mà chúng ta quan tâm như sau:

```kotlin
@MainThread
final void clear() {
    mCleared = true;
    // Since clear() is final, this method is still called on mock 
    // objects and in those cases, mBagOfTags is null. It'll always 
    // be empty though because setTagIfAbsent and getTag are not 
    // final so we can skip clearing it
    if (mBagOfTags != null) {
        for (Object value : mBagOfTags.values()) {
            // see comment for the similar call in setTagIfAbsent
            closeWithRuntimeException(value);
        }
    }
    onCleared();
}
```

Phương thức này đi qua tất cả các mục trong bag và gọi closeWithRuntimeException kiểm tra xem đối tượng có phải là Closeable không và nếu có thì đóng nó. Để ViewModel có thể đóng scope, nó cần implement interface Closeable. Đó là lý do viewModelScope có kiểu CloseableCoroutineScope extend từ CoroutineScope, ghi đè coroutineContext và thực hiện interface Closeable.

```kotlin
internal class CloseableCoroutineScope(
    context: CoroutineContext
) : Closeable, CoroutineScope {
  
    override val coroutineContext: CoroutineContext = context
  
    override fun close() {
        coroutineContext.cancel()
    }
}
```

## Dispatchers.Main được set là mặc định

```Dispatchers.Main.immediate``` được đặt là ```CoroutineDispatcher``` mặc định cho ```viewModelScope```.

```kotlin
val scope = CloseableCoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
```

```Dispatchers.Main``` là lựa chọn hợp lý trong trường hợp này vì ViewModel là một khái niệm liên quan đến UI và thường liên quan đến việc cập nhật nó, vì vậy việc sử dụng dispatcher khác sẽ dẫn tới chuyển đổi giữa các luồng ít nhất 2 lần. Giả sử rằng các suspend functions sẽ thực hiện các ở các thread của chúng một cách chính xác, việc chọn các Dispatchers khác sẽ không phải là một lựa chọn tốt vì chúng ta đang giả sử rằng ViewModel đang thực hiện.

```immediate``` được sử dụng để thực thi coroutine ngay lập tức mà không cần phải điều chuyển lại công việc đến luồng phù hợp.

## Unit Testing cho viewModelScope

```Dispatchers.Main``` sử dụng phương thức ```Looper.getMainLooper()``` trong Android để chạy code trên luồng UI. Phương thức đó có sẵn trong các bài kiểm tra Android Instrumented nhưng không có trong các case Unit Test.

Sử dụng thư viện ```org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutines_version``` để thay thế Coroutines Main Dispatcher bằng cách gọi ```Dispatchers.setMain(dispatcher: CoroutineDispatcher)``` với ```TestCoroutineDispatcher``` có sẵn trong ```org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutines_version```. Lưu ý rằng ```Dispatchers.setMain``` chỉ cần thiết nếu bạn sử dụng ```viewModelScope``` hoặc bạn hardcode ```Dispatchers.Main``` trong codebase của bạn.

```TestCoroutineDispatcher``` là một dispatcher cho phép chúng ta kiểm soát cách coroutine được thực thi, có thể tạm dừng/đi tiếp thực thi và kiểm soát đồng hồ ảo của nó. Nó được thêm vào như một API thử nghiệm trong Kotlin Coroutines v1.

Không nên sử dụng ```Dispatchers.Unconfined``` như một thay thế của ```Dispatchers.Main```, nó sẽ phá vỡ tất cả các giả định và đồng bộ hóa cho code sử dụng Dispatchers.Main. Vì một unit test nên chạy tốt độc lập và không có bất kỳ ảnh hưởng phụ nào, bạn nên gọi ```Dispatchers.resetMain()``` và làm sạch executor khi unit test kết thúc.

```kotlin
@ExperimentalCoroutinesApi
class CoroutinesTestRule(
        val testDispatcher: TestCoroutineDispatcher = TestCoroutineDispatcher()
) : TestWatcher() {

    override fun starting(description: Description?) {
        super.starting(description)
        Dispatchers.setMain(testDispatcher)
    }

    override fun finished(description: Description?) {
        super.finished(description)
        Dispatchers.resetMain()
        testDispatcher.cleanupTestCoroutines()
    }
}
```

Bây giờ bạn có thể sử dụng nó trong unit test của bạn:

```kotlin
class MainViewModelUnitTest {
  
    @get:Rule
    var coroutinesTestRule = CoroutinesTestRule()
  
    @Test
    fun test() {
        /* ... */
    }
}
```

## Test coroutine với Mockito

Bạn có sử dụng ```Mockito``` và muốn xác minh rằng tương tác với một đối tượng đã xảy ra? Lưu ý rằng việc sử dụng phương thức ```verify``` của Mockito không phải là cách ưu tiên để kiểm thử đơn vị mã của bạn. Bạn nên kiểm tra logic cụ thể của ứng dụng như là một phần tử có tồn tại thay vì xác minh rằng tương tác với một đối tượng đã xảy ra.

Trước khi kiểm tra rằng tương tác với một đối tượng đã xảy ra, chúng ta cần đảm bảo rằng tất cả các coroutine được khởi chạy đã kết thúc. Hãy xem ví dụ sau.

```kotlin
class MainViewModel(private val dependency: Any): ViewModel {
  
  fun sampleMethod() {
    viewModelScope.launch {
      val hashCode = dependency.hashCode()
      // TODO: do something with hashCode
  }
}

class MainViewModelUnitTest {

  // Mockito setup goes here
  /* ... */
  
  @get:Rule
  var coroutinesTestRule = CoroutinesTestRule()
  
  @Test
  fun test() = coroutinesTestRule.testDispatcher.runBlockingTest {
    val subject = MainViewModel(mockObject)
    subject.sampleMethod()
    // Checks mockObject called the hashCode method that is expected from the coroutine created in sampleMethod
    verify(mockObject).hashCode()
  }
}
```

Trong bài kiểm tra, chúng ta gọi phương thức runBlockingTest bên trong TestCoroutineDispatcher mà quy tắc tạo ra. Vì Dispatcher này ghi đè Dispatchers.Main, MainViewModel sẽ chạy coroutine trên Dispatcher này. Gọi runBlockingTest sẽ khiến coroutine thực thi đồng bộ trong bài kiểm tra. Vì cuộc gọi verify Mockito của chúng ta nằm trong khối runBlockingTest, nó sẽ được gọi sau khi coroutine kết thúc và tương tác sẽ xảy ra tại thời điểm đó.

Đối với ví dụ khác, hãy xem cách chúng tôi thêm loại unit test này vào Codelab Kotlin Coroutines trong [PR này](https://github.com/googlecodelabs/kotlin-coroutines/pull/29).

Nếu bạn đang sử dụng các architecture component, ViewModel và coroutines, hãy sử dụng ```viewModelScope``` để framework quản lý vòng đời của nó cho bạn. Điều này là một lựa chọn tối ưu nhất!

[Codelab Kotlin Coroutines](https://codelabs.developers.google.com/codelabs/kotlin-coroutines) đã được cập nhật để sử dụng nó. Ghé qua để tìm hiểu thêm về Coroutines và cách sử dụng chúng trong ứng dụng Android của bạn.





