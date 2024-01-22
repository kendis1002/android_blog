---
layout: post
current: post
cover: assets/images/collect-flow.png
navigation: True
title: Cách an toàn để thu thập các flow ở Android UI
date: 2024-01-22 10:18:00
tags: coroutine
class: post-template
subclass: 'post'
author: kendis
---

Học cách sử dụng API Lifecycle.repeatOnLifecycle để an toàn thu thập flows ở tầng UI trên Android.

Trong một ứng dụng Android, [Kotlin flows](https://developer.android.com/kotlin/flow) thường được thu thập từ UI để hiển thị cập nhật dữ liệu trên màn hình. Tuy nhiên, bạn muốn thu thập những flows này, bạn phải đảm bảo rằng bạn không làm việc nhiều hơn cần thiết, lãng phí tài nguyên (cả CPU và bộ nhớ) hoặc rò rỉ dữ liệu khi giao diện đi vào nền.

Trong bài viết này, bạn sẽ tìm hiểu cách ```Lifecycle.repeatOnLifecycle``` và ```Flow.flowWithLifecycle``` bảo vệ bạn khỏi lãng phí tài nguyên và tại sao chúng là một lựa chọn tốt để sử dụng cho việc thu thập flow trong UI.

## Lãng phí tài nguyên
API Flow<T> nên được xuất ra từ các tầng thấp hơn của cấu trúc ứng dụng của bạn bất kể chi tiết cài đặt của item phát flow. Tuy nhiên, bạn cũng nên thu thập chúng một cách an toàn.

Một cold flow được hỗ trợ bởi một [Channel](https://kotlinlang.org/docs/channels.html) hoặc sử dụng các toán tử với bộ đệm như [```buffer```](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/buffer.html), [```conflate```](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/conflate.html), [```flowOn```](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/flow-on.html) hoặc [```shareIn```](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/share-in.html) không an toàn để thu thập với một số API hiện có như [```CoroutineScope.launch```](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/launch.html), [Flow<T>.launchIn](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/launch-in.html) hoặc [```LifecycleCoroutineScope.launchWhenX```](https://developer.android.com/reference/kotlin/androidx/lifecycle/LifecycleCoroutineScope), trừ khi bạn hủy ```job``` bắt đầu coroutine khi Activity đi vào nền. Những API này sẽ giữ nguyên flow phát item trong flow vẫn hoạt động trong khi phát ra các item vào bộ đệm ở nền, và do đó lãng phí tài nguyên.

> Ghi chú: Cold flow là một loại folw thực hiện khối phát khi có một người đăng ký mới.

Ví dụ, hãy xem xét flow này phát ra cập nhật Vị trí bằng cách sử dụng callbackFlow:

```kotlin
// Implementation of a cold flow backed by a Channel that sends Location updates
fun FusedLocationProviderClient.locationFlow() = callbackFlow<Location> {
    val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult?) {
            result ?: return
            try { offer(result.lastLocation) } catch(e: Exception) {}
        }
    }
    requestLocationUpdates(createLocationRequest(), callback, Looper.getMainLooper())
        .addOnFailureListener { e ->
            close(e) // in case of exception, close the Flow
        }
    // clean up when Flow collection ends
    awaitClose {
        removeLocationUpdates(callback)
    }
}
```

> Lưu ý: Bên trong, callbackFlow sử dụng một Channel, mà khá tương tự với hàng đợi chặn, và có dung lượng mặc định là 64 phần tử.

Thu thập flow này ở UI bằng cách sử dụng bất kỳ API nào đã đề cập giữ cho flow phát ra các vị trí ngay cả khi giao diện không hiển thị chúng trong UI! Xem ví dụ dưới đây:

```kotlin
class LocationActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Collects from the flow when the View is at least STARTED and
        // SUSPENDS the collection when the lifecycle is STOPPED.
        // Collecting the flow cancels when the View is DESTROYED.
        lifecycleScope.launchWhenStarted {
            locationProvider.locationFlow().collect {
                // New location! Update the map
            } 
        }
        // Same issue with:
        // - lifecycleScope.launch { /* Collect from locationFlow() here */ }
        // - locationProvider.locationFlow().onEach { /* ... */ }.launchIn(lifecycleScope)
    }
}
```

```lifecycleScope.launchWhenStarted``` tạm dừng việc thực hiện coroutine. Các vị trí mới không được xử lý, nhưng nguồn phát của ```callbackFlow``` vẫn tiếp tục gửi các vị trí. Sử dụng ```lifecycleScope.launch``` hoặc ```launchIn``` APIs còn nguy hiểm hơn vì view vẫn tiếp tục tiêu thụ các vị trí ngay cả khi nó ở nền! Điều này có thể gây crash ứng dụng của bạn.

Để giải quyết vấn đề này với các APIs này, bạn cần phải hủy bỏ việc thu thập một cách thủ công khi view đi vào nền để hủy bỏ ```callbackFlow``` và tránh việc location nguồn phát phát ra các item và lãng phí tài nguyên. Ví dụ, bạn có thể làm một cái gì đó như sau:

```kotlin
class LocationActivity : AppCompatActivity() {

    // Coroutine listening for Locations
    private var locationUpdatesJob: Job? = null

    override fun onStart() {
        super.onStart()
        locationUpdatesJob = lifecycleScope.launch {
            locationProvider.locationFlow().collect {
                // New location! Update the map
            } 
        }
    }

    override fun onStop() {
        // Stop collecting when the View goes to the background
        locationUpdatesJob?.cancel()
        super.onStop()
    }
}
```

Đó là một giải pháp tốt, nhưng đó là boilerplate. Và nếu có một sự thật vô cùng về các nhà phát triển Android, đó là chúng ta cực kì ghét việc viết code boilerplate. Một trong những lợi ích lớn nhất của việc không cần phải viết code boilerplate là với ít code hơn, có ít cơ hội mắc lỗi hơn!

## Lifecycle.repeatOnLifecycle

Bây giờ khi chúng ta đều hiểu vấn đề nằm ở đâu, đến lúc nghĩ ra một giải pháp. Giải pháp cần phải 1) đơn giản, 2) thân thiện hoặc dễ nhớ/hiểu, và quan trọng hơn là 3) an toàn! Nó nên hoạt động cho tất cả các trường hợp sử dụng không phụ thuộc vào các chi tiết triển khai flow.

Không cần phải chờ đợi nữa, API mà bạn nên sử dụng là ```Lifecycle.repeatOnLifecycle``` có sẵn trong thư viện [lifecycle-runtime-ktx](https://developer.android.com/jetpack/androidx/releases/lifecycle).

> Chú ý: API này có sẵn trong thư viện lifecycle:lifecycle-runtime-ktx:2.4.0-alpha01 hoặc mới hơn.

Nhìn vào đoạn code sau đây:

```kotlin
class LocationActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Create a new coroutine since repeatOnLifecycle is a suspend function
        lifecycleScope.launch {
            // The block passed to repeatOnLifecycle is executed when the lifecycle
            // is at least STARTED and is cancelled when the lifecycle is STOPPED.
            // It automatically restarts the block when the lifecycle is STARTED again.
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                // Safely collect from locationFlow when the lifecycle is STARTED
                // and stops collection when the lifecycle is STOPPED
                locationProvider.locationFlow().collect {
                    // New location! Update the map
                }
            }
        }
    }
}
```

```repeatOnLifecycle``` là một suspend function có tham số là ```Lifecycle.State``` được sử dụng để **tự động tạo và khởi chạy một coroutine mới** với khối code được truyền vào khi vòng đời ở trạng thái nhất định, và hủy coroutine đang diễn ra khi vòng đời rơi xuống dưới trạng thái đó.

Điều này tránh bất kỳ mã boilerplate nào vì mã liên quan để hủy coroutine khi nó không còn cần thiết được thực hiện tự động bởi ```repeatOnLifecycle```. Như bạn có thể đoán, nó được khuyến nghị để gọi API này trong phương thức ```onCreate``` của activity hoặc ```onViewCreated``` của fragment để tránh hành vi không mong muốn. Xem ví dụ dưới đây sử dụng fragment:

```kotlin
class LocationFragment: Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        // ...
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                locationProvider.locationFlow().collect {
                    // New location! Update the map
                }
            }
        }
    }
}
```

**Quan trọng**: Fragment luôn nên sử dụng ```viewLifecycleOwner``` để cập nhật giao diện người dùng. Tuy nhiên, điều này không áp dụng cho ```DialogFragment``` vì đôi khi chúng không có một View. Đối với ```DialogFragment```, bạn có thể sử dụng lifecycleOwner.

> Chú ý: API này có sẵn trong thư viện lifecycle:lifecycle-runtime-ktx:2.4.0-alpha01 hoặc mới hơn.

## Bên dưới

Hàm ```repeatOnLifecycle``` tạm dừng coroutine gọi, khởi động lại khối code khi vòng đời di chuyển vào và ra khỏi ```state``` cụ thể trong một coroutine mới, và t**iếp tục coroutine gọi khi vòng đời bị hủy**. Điểm cuối cùng này rất quan trọng: coroutine gọi ```repeatOnLifecycle``` sẽ không tiếp tục thực hiện cho đến khi vòng đời bị hủy.

```kotlin
class LocationActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Create a coroutine
        lifecycleScope.launch {
            
            lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
                // Repeat when the lifecycle is RESUMED, cancel when PAUSED
            }

            // `lifecycle` is DESTROYED when the coroutine resumes. repeatOnLifecycle
            // suspends the execution of the coroutine until the lifecycle is DESTROYED.
        }
    }
}
```

## Sơ đồ trực quan

Quay lại từ đầu, việc thu thập ```locationFlow``` trực tiếp từ một coroutine bắt đầu bằng ```lifecycleScope.launch``` là rất nguy hiểm vì quá trình thu thập vẫn tiếp tục diễn ra ngay cả khi View đang ở chế độ nền. 

```repeatOnLifecycle``` giúp bạn tránh lãng phí tài nguyên và gặp app crash vì nó dừng và khởi động lại bộ sưu tập flow khi vòng đời di chuyển vào và ra khỏi trạng thái mục tiêu.

![Sự khác biệt giữa việc sử dụng và không sử dụng API repeatOnLifecycle.](/Users/trandinhquy/Documents/Blog/jasper2/assets/images/collect-flow-1.png "Sự khác biệt giữa việc sử dụng và không sử dụng API repeatOnLifecycle.")

## Flow.flowWithLifecycle



Bạn cũng có thể sử dụng toán tử ```Flow.flowWithLifecycle``` khi bạn chỉ có một flow để thu thập. API này sử dụng API ```Lifecycle.repeatOnLifecycle``` và phát ra các item và hủy bỏ nguồn phát cơ bản khi ```Lifecycle``` di chuyển vào và ra khỏi trạng thái mục tiêu.

```kotlin
class LocationActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        locationProvider.locationFlow()
            .flowWithLifecycle(this, Lifecycle.State.STARTED)
            .onEach {
                // New location! Update the map
            }
            .launchIn(lifecycleScope) 
    }
}
```

> Lưu ý: Tên API này lấy toán tử ```Flow.flowOn(CoroutineContext)``` làm tiền lệ vì ```Flow.flowWithLifecycle``` thay đổi ```CoroutineContext``` được sử dụng để thu thập upstream flow nguồn lên trong khi không ảnh hưởng đến downstream flow. Tương tự như ```flowOn```, ```Flow.flowWithLifecycle``` cũng thêm một bộ đệm trong trường hợp consumer không theo kịp nguồn phát. Điều này là do việc triển khai nó sử dụng một ```callbackFlow```.

## Định cấu hình nhà nguồn phát cơ bản

Ngay cả khi bạn sử dụng các API này, hãy cẩn thận với các flow nóng có thể lãng phí tài nguyên ngay cả khi chúng không được ai thu thập! Có một số trường hợp sử dụng hợp lệ cho chúng, nhưng hãy ghi nhớ điều đó và ghi lại nếu cần. Việc để nguồn phát flow cơ bản hoạt động ở chế độ nền, ngay cả khi lãng phí tài nguyên, có thể có lợi cho một số trường hợp sử dụng: bạn có ngay dữ liệu mới thay vì bắt kịp và tạm thời hiển thị dữ liệu cũ. **Tùy thuộc vào trường hợp sử dụng, quyết định xem nguồn phát có cần luôn hoạt động hay không**.

Các API ```MutableStateFlow``` và ```MutableSharedFlow``` hiển thị trường ```subscriptionCount``` mà bạn có thể sử dụng để dừng nguồn phát cơ bản khi số lượt đăng ký bằng 0. Theo mặc định, chúng sẽ giữ cho nguồn phát hoạt động miễn là đối tượng chứa instance của flow vẫn còn trong bộ nhớ. Tuy nhiên, có một số trường hợp sử dụng hợp lệ cho việc này, chẳng hạn như ```UiState``` được hiển thị từ ViewModel tới giao diện người dùng bằng ```StateFlow```. Vậy là được rồi! Trường hợp sử dụng này yêu cầu ViewModel luôn cung cấp trạng thái giao diện người dùng mới nhất cho View.

Tương tự, toán tử[`Flow.stateIn`](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/state-in.html) và [`Flow.shareIn`](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/share-in.html) có thể cấu hình với [sharing started policy](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-sharing-started/index.html) cho việc này. [`WhileSubscribed()`](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-sharing-started/-while-subscribed.html) sẽ dừng nguồn phát cơ bản khi mà không có observer nào! Ngược lại, [`Eagerly`](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-sharing-started/-eagerly.html) hay [`Lazily`](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-sharing-started/-lazily.html) sẽ giữ nguồn phát cơ bản hoạt động miễn là ```CoroutineScope``` sử dụng vẫn hoạt động.

> Lưu ý: Các API hiển thị trong bài viết này là một mặc định phù hợp để thu thập các flow từ UI và nên được sử dụng bất kể chi tiết triển khai flow đó như thế nào. Các API này thực hiện những việc cần làm: ngừng thu thập nếu UI không hiển thị trên màn hình. Việc triển khai flow có luôn hoạt động hay không là tùy thuộc vào việc triển khai flow.

## Thu thập Flow an toàn trong Jetpack Compose

Hàm ```Flow.collectAsState``` được dùng trong Compose để thu thập các flow từ các composable và biểu thị các giá trị dưới dạng ```State<T>``` để có thể cập nhật UI Compose. Ngay cả khi Compose không render lại, người dùng khi Activity hoặc Fragment ở chế độ nền thì nguồn phát flow vẫn hoạt động và có thể lãng phí tài nguyên. Compose có thể gặp phải vấn đề tương tự như hệ thống View. 

Khi thu thập các flow trong Compose, hãy sử dụng toán tử ```Flow.flowWithLifecycle``` như sau:

```kotlin
@Composable
fun LocationScreen(locationFlow: Flow<Flow>) {

    val lifecycleOwner = LocalLifecycleOwner.current
    val locationFlowLifecycleAware = remember(locationFlow, lifecycleOwner) {
        locationFlow.flowWithLifecycle(lifecycleOwner.lifecycle, Lifecycle.State.STARTED)
    }

    val location by locationFlowLifecycleAware.collectAsState()

    // Current location, do something with it
}
```

Lưu ý rằng bạn cần ```remember``` flow nhận biết vòng đời với ```locationFlow``` và ```lifecycleOwner``` chính là chìa khóa để luôn sử dụng cùng một flow trừ khi một trong các khóa thay đổi. 

Trong Compose, các tác dụng phụ phải được thực hiện trong môi trường được kiểm soát. Để làm được điều đó, hãy sử dụng ```LaunchedEffect``` để tạo một coroutine tuân theo vòng đời của compose. Trong khối của nó, bạn có thể gọi suspend ```Lifecycle.repeatOnLifecycle``` nếu bạn cần nó để khởi chạy lại một khối code khi vòng đời máy chủ ở một ```State``` nhất định.

## So sánh với LiveData

Bạn có thể nhận thấy rằng API này hoạt động tương tự như ```LiveData``` và điều đó đúng! ```LiveData```nhận thức được Vòng đời và hành vi khởi động lại của nó khiến nó trở nên lý tưởng để quan sát các flow dữ liệu từ giao diện người dùng. Và đó cũng là trường hợp của các API ```Lifecycle.repeatOnLifecycle``` và ```Flow.flowWithLifecycle```!

Việc thu thập các flow bằng cách sử dụng các API này là sự thay thế đương nhiên cho ```LiveData``` trong các ứng dụng chỉ dành cho Kotlin. Nếu bạn sử dụng các API này để thu thập flow, ```LiveData``` sẽ không mang lại bất kỳ lợi ích nào so với coroutine và flow. Hơn nữa, các flow còn linh hoạt hơn vì chúng có thể được thu thập từ bất kỳ ```Dispatcher``` nào và chúng có thể được cung cấp sức mạnh bởi tất cả [các toán tử của nó](https://kotlin.github.io/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-flow/). Ngược lại với ```LiveData```, có sẵn các toán tử hạn chế và các giá trị của chúng luôn được quan sát từ UI thread.

## StateFlow hỗ trợ data binding

Một lưu ý khác, một trong những lý do khiến bạn có thể sử dụng ```LiveData``` là vì nó được hỗ trợ data binding. Chà, ```StateFlow``` cũng vậy! Để biết thêm thông tin về hỗ trợ ```StateFlow``` trong data binding, hãy xem [tài liệu chính thức](https://developer.android.com/topic/libraries/data-binding/observability#stateflow).

------

Sử dụng API ```Lifecycle.repeatOnLifecycle``` hoặc ```Flow.flowWithLifecycle``` để thu thập các flow từ lớp giao diện người dùng trong Android một cách an toàn.

