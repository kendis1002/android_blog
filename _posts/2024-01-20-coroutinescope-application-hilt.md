---
layout: post
current: post
cover: assets/images/viewmodelscope.png
navigation: True
title: Tạo 1 ứng dụng CoroutineScope sử dụng Hilt
date: 2024-01-20 10:18:00
tags: coroutine hilt
class: post-template
subclass: 'post'
author: kendis
---

Inject một CoroutineScope phạm vi mức Application sử dụng Hilt.

Theo các best practice của coroutine, bạn có thể cần phải inject một CoroutineScope phạm vi ứng dụng vào một số class để khởi chạy các coroutine mới theo vòng đời ứng dụng hoặc để làm cho một số công việc tồn tại lâu hơn scope của người gọi.

Trong bài viết này, bạn sẽ học cách tạo một ```CoroutineScope``` có phạm vi ứng dụng bằng cách sử dụng Hilt, và cách inject nó như một phụ thuộc. Để cải thiện cách chúng ta làm việc với Coroutines, chúng ta sẽ xem cách tiêm các ```CoroutineDispatcher``` khác nhau và thay thế cài đặt của chúng trong các bài test.

## Dependency injection bằng tay
Để tạo một ```CoroutineScope``` phạm vi ứng dụng theo các nguyên tắc DI mà không cần sử dụng thư viện nào, bạn thường sẽ thêm một biến mới vào lớp ứng dụng của bạn với một phiên bản của ```CoroutineScope```. Cùng một instance sẽ được truyền thủ công khi tạo các đối tượng khác.

```kotlin
class MyRepository(private val externalScope: CoroutineScope) { /* ... */ }

class MyApplication : Application() {

    // Application-scoped types that any class in the app could access
    // using the applicationContext.
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val myRepository = MyRepository(applicationScope)

}
```

Vì không có cách đáng tin cậy nào để biết khi ```Application``` bị hủy bỏ trong Android, bạn không cần gọi ```applicationScope.cancel()``` bằng tay vì phạm vi và tất cả công việc đang diễn ra sẽ bị hủy bỏ khi application process kết thúc.

Một lựa chọn tốt hơn cho việc làm điều này bằng cách thủ công là tạo một class ```ApplicationContainer ``` chứa các loại có phạm vi ứng dụng. Điều này giúp phân chia vấn đề vì những lớp Container này chịu trách nhiệm về:

- xử lý logic về cách xây dựng các loại cụ thể,
- giữ các instance có loại là container-scoped, và
- trả về các instance của các loại đã được phạm vi hoá và không được phạm vi hoá.

```kotlin
class ApplicationDiContainer {
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val myRepository = MyRepository(applicationScope)
}

class MyApplication : Application() {
    val applicationDiContainer = ApplicationDiContainer()
}
```

> Chú ý: Một container luôn trả về cùng một instance của một loại được giới hạn, và luôn trả về một instance khác cho các loại không được phạm vi hoá. Việc giới hạn các loại vào container tốn kém vì đối tượng được giới hạn vẫn tồn tại trong bộ nhớ cho đến khi thành phần bị hủy, vì vậy chỉ giới hạn những gì thực sự cần thiết.

Trong ví dụ ```ApplicationDiContainer``` ở trên, tất cả các loại đều được phạm vi hóa. Nếu ```MyRepository``` không cần phải được phạm vi hóa cho ứng dụng, chúng ta sẽ có:

```kotlin
class ApplicationDiContainer {
    // Scoped type. Same instance is always returned
    val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // Unscoped type. Always returns a different instance
    fun getMyRepository(): MyRepository {
        return MyRepository(applicationScope)
    }
}
```

## Sử dụng Hilt trong ứng dụng

Hilt tạo ra những gì bạn có thể thấy trong ```ApplicationDiContainer``` (và hơn thế nữa!) lúc biên dịch bằng cách sử dụng các annotation. Hơn nữa, Hilt cung cấp các container cho [hầu hết các class Android](https://developer.android.com/training/dependency-injection/hilt-android#generated-components) framework không chỉ mỗi class Application.

Để thiết lập Hilt trong ứng dụng của bạn và tạo container cho lớp ```Application```, hãy đánh dấu class ```Application``` của bạn bằng ```@HiltAndroidApp```.

```kotlin
@HiltAndroidApp
class MyApplication : Application()
```

Với điều này, ApplicationDiContainer đã sẵn sàng để sử dụng. Chúng ta chỉ cần cho Hilt biết cách cung cấp các instance của các loại khác nhau.

> Lưu ý: Trong Hilt, các class Container được tham chiếu như là Components. Container liên kết với class ```Application``` được gọi là ```SingletonComponent```. Kiểm tra danh sách tất cả [các Hilt component có sẵn](https://developer.android.com/training/dependency-injection/hilt-android#generated-components).

## Inject thông qua constructor

Construction injection là cách dễ nhất để cho Hilt biết cách cung cấp các instance của một loại nếu chúng ta có quyền truy cập vào constructor của một class, chúng ta chỉ cần đánh dấu constructor bằng ```@Inject```:

```kotlin
@Singleton // Scopes this type to the SingletonComponent
class MyRepository @Inject constructor(
   private val externalScope: CoroutineScope
) { 
    /* ... */ 
}
```

Điều này cho biết với Hilt rằng để cung cấp một instance của class ```MyRepository```, cần phải truyền một instance của ```CoroutineScope``` như một phụ thuộc. Hilt tạo code tại thời điểm biên dịch để đảm bảo các phụ thuộc được đáp ứng và truyền vào khi tạo một instance của một loại hoặc thông báo lỗi nếu nó không có đủ thông tin. ```@Singleton``` được sử dụng để phạm vi hoá lớp này đến ```SingletonContainer```.

Tại thời điểm này, Hilt không biết cách đáp ứng sự phụ thuộc ```CoroutineScope``` vì chúng ta chưa nói cho Hilt biết làm thế nào. Các phần tiếp theo sẽ giải thích cách chúng ta có thể cho Hilt biết cần truyền gì làm phụ thuộc.

>  Lưu ý: Hilt cung cấp một annotation khác nhau cho các loại scope cho các thành phần Hilt khác nhau. Hãy kiểm tra [danh sách tất cả các phạm vi thành phần có sẵn](https://developer.android.com/training/dependency-injection/hilt-android#component-scopes).

## Bindings

***Binding*** là một thuật ngữ phổ biến trong Hilt để chỉ thông tin mà Hilt biết về cách cung cấp các instance của một loại như một phụ thuộc. Chúng ta có thể nói rằng chúng ta đã thêm một binding vào Hilt với chú thích ```@Inject``` của đoạn code ở trên.

Các binding qua [cấu trúc thành phần của Hilt](https://developer.android.com/training/dependency-injection/hilt-android#component-hierarchy). Các binding có sẵn trong ```SingletonComponent``` cũng có sẵn trong ```ActivityComponent```.

Các binding cho các loại không được phạm vi hoá (một ví dụ có thể là đoạn code ```MyRepository``` ở trên nếu nó không được ghi chú với ```@Singleton```), có sẵn trong tất cả các thành phần của Hilt. Các binding được phạm vi hoá cho một thành phần, như ```MyRepository``` được ghi chú với ```@Singleton```, có sẵn cho thành phần có phạm vi và các thành phần ở dưới nó trong cấu trúc.

## Cung cấp loại với module

Như đã đề cập ở trên, chúng ta cần cho Hilt biết cách để đáp ứng mối phụ thuộc vào ```CoroutineScope```. Tuy nhiên, ```CoroutineScope``` là một loại interface đến từ một thư viện bên ngoài, vì vậy chúng ta không thể sử dụng việc tiêm (injection) thông qua constructor như trước đây với class ```MyRepository```. Phương pháp thay thế là cho Hilt biết code nào để chạy khi cung cấp một instance của một loại sử dụng Modules:

```kotlin
@InstallIn(SingletonComponent::class)
@Module
object CoroutinesScopesModule {

    @Singleton // Provide always the same instance 
    @Provides
    fun providesCoroutineScope(): CoroutineScope {
        // Run this code when providing an instance of CoroutineScope
        return CoroutineScope(SupervisorJob() + Dispatchers.Default)
    }
}
```

Phương thức ```@Provides``` được chú thích bằng ```@Singleton``` để Hilt luôn trả về cùng một instance của CoroutineScope đó. Điều này bởi vì bất kỳ công việc nào cần tuân theo vòng đời của ```Application``` đều nên được tạo ra bằng cùng một instance của ```CoroutineScope``` tuân theo vòng đời của ```Application```.

Các module Hilt được chú thích bằng ```@InstallIn``` để chỉ ra rằng việc binding được cài đặt trong thành phần Hilt nào (và các thành phần bên dưới trong cấu trúc phân cấp). Trong trường hợp của chúng ta, vì ```CoroutineScope``` của ứng dụng cần thiết cho ```MyRepository``` được phạm vi hoá trong ```SingletonComponent```, việc binding này cũng cần được cài đặt trong ```SingletonComponent```.

Trong cách nói của Hilt, chúng ta có thể nói rằng chúng ta đã thêm một ```CoroutineScope``` binding, vì bây giờ, Hilt biết cách cung cấp các instance của ```CoroutineScope```.

Tuy nhiên, đoạn code trên có thể được cải thiện. Hardcoding dispatchers là một thói quen không tốt trong coroutines, chúng ta nên inject chúng để **làm cho chúng có thể cấu hình và làm cho việc kiểm thử dễ dàng hơn**. Theo đoạn code trước đó, chúng ta có thể tạo một module Hilt mới để cho phép nó biết Dispatcher nào để inject cho mỗi trường hợp: main, default và IO.

## Cung cấp các implementation cho CoroutineDispatcher

Chúng ta phải cung cấp các implementation khác nhau cho cùng một loại là ```CoroutineDispatcher```. Nói cách khác, chúng ta cần các ràng buộc khác nhau cho cùng một loại.

Chúng ta sử dụng [qualifier (bộ điều kiện)](https://developer.android.com/training/dependency-injection/hilt-android#multiple-bindings) để cho Hilt biết rằng mỗi lần nào sử dụng binding hoặc implementation nào. Qualifier chỉ là các annotation mà bạn và Hilt sử dụng để xác định các binding cụ thể. Hãy tạo một qualifier cho mỗi implementation của CoroutineDispatcher:

```kotlin
// CoroutinesQualifiers.kt file

@Retention(AnnotationRetention.RUNTIME)
@Qualifier
annotation class DefaultDispatcher

@Retention(AnnotationRetention.RUNTIME)
@Qualifier
annotation class IoDispatcher

@Retention(AnnotationRetention.RUNTIME)
@Qualifier
annotation class MainDispatcher

@Retention(AnnotationRetention.BINARY)
@Qualifier
annotation class MainImmediateDispatcher
```

Sau đó, những qualifier này chú thích các phương thức ```@Provides``` khác nhau để xác định một binding cụ thể trong các mô-đun Hilt. Bộ qualifier ```@DefaultDispatcher``` chú thích phương thức trả về bộ điều phối mặc định, và cứ thế.

```kotlin
@InstallIn(SingletonComponent::class)
@Module
object CoroutinesDispatchersModule {

    @DefaultDispatcher
    @Provides
    fun providesDefaultDispatcher(): CoroutineDispatcher = Dispatchers.Default

    @IoDispatcher
    @Provides
    fun providesIoDispatcher(): CoroutineDispatcher = Dispatchers.IO

    @MainDispatcher
    @Provides
    fun providesMainDispatcher(): CoroutineDispatcher = Dispatchers.Main

    @MainImmediateDispatcher
    @Provides
    fun providesMainImmediateDispatcher(): CoroutineDispatcher = Dispatchers.Main.immediate
}
```

Lưu ý rằng những ```CoroutineDispatchers``` này không cần được phạm vi hoá trong ```SingletonComponent```. Mỗi khi cần các phụ thuộc này, Hilt gọi phương thức ```@Provides``` và trả về ```CoroutineDispatcher``` tương ứng. Tạo lại vẫn OK.

## Cung cấp Coroutine Scope ở mức Application

Để loại bỏ ```CoroutineDispatcher``` được hard code từ ```CoroutineScope``` ở mức Application trước đó của chúng ta, chúng ta cần inject vào dispatcher mặc định do Hilt cung cấp. Để làm điều đó, chúng ta có thể truyền vào loại mà chúng ta muốn inject, ```CoroutineDispatcher```, bằng cách sử dụng qualifier tương ứng, ```@DefaultDispatcher```, như một phụ thuộc trong phương thức cung cấp ```CoroutineScope``` của ứng dụng.

```kotlin
@InstallIn(SingletonComponent::class)
@Module
object CoroutinesScopesModule {

    @Singleton
    @Provides
    fun providesCoroutineScope(
        @DefaultDispatcher defaultDispatcher: CoroutineDispatcher
    ): CoroutineScope = CoroutineScope(SupervisorJob() + defaultDispatcher)
}
```

Vì Hilt có nhiều ràng buộc cho loại ```CoroutineDispatcher```, chúng ta làm rõ nó sử dụng chính xác loại nào bằng cách sử dụng chú thích ```@DefaultDispatcher``` khi ```CoroutineDispatcher``` được sử dụng làm phụ thuộc.

## Qualifier cho ApplicationScope

```kotlin
@Retention(AnnotationRetention.RUNTIME)
@Qualifier
annotation class ApplicationScope

@InstallIn(SingletonComponent::class)
@Module
object CoroutinesScopesModule {

    @Singleton
    @ApplicationScope
    @Provides
    fun providesCoroutineScope(
        @DefaultDispatcher defaultDispatcher: CoroutineDispatcher
    ): CoroutineScope = CoroutineScope(SupervisorJob() + defaultDispatcher)
}
```

Vì ```MyRepository``` phụ thuộc vào scope này, rõ ràng scope bên ngoài nào sử dụng như triển khai sau:

```kotlin
@Singleton
class MyRepository @Inject constructor(
    @ApplicationScope private val externalScope: CoroutineScope
) { /* ... */ }
```

## Thay thế Replacing Dispatchers cho instrumentation test

Chúng ta đã nói trước đó rằng chúng ta nên inject dispatchers để làm cho việc kiểm thử dễ dàng hơn và có hoàn toàn kiểm soát được những gì đang xảy ra. Đối với các bài kiểm tra instrumentation, chúng ta muốn làm cho Espresso đợi cho đến khi các coroutines hoàn thành.

Thay vì tạo một ```CoroutineDispatcher``` tùy chỉnh với một số Espresso Idling resource để khiến nó chờ các coroutine hoàn thành, chúng ta có thể tận dụng API AsyncTask. Mặc dù AsyncTask đã bị loại bỏ trong Android API 30, Espresso kết nối vào thread pool của nó để kiểm tra tính trống rỗng. Do đó, bất kỳ coroutine nào cần được thực thi trong một luồng nền có thể được thực thi trong thread pool của AsyncTask.

Sử dụng API ```TestInstallIn``` của Hilt để Hilt cung cấp một cách triển khai khác của một loại trong các bài test. Tương tự như cách chúng ta cung cấp các Dispatcher khác nhau ở trên, chúng ta có thể tạo một file mới trong gói ```androidTest``` để cung cấp các triển khai khác nhau cho những Dispatcher đó.

```kotlin
// androidTest/projectPath/TestCoroutinesDispatchersModule.kt file

@TestInstallIn(
    components = [SingletonComponent::class],
    replaces = [CoroutinesDispatchersModule::class]
)
@Module
object TestCoroutinesDispatchersModule {

    @DefaultDispatcher
    @Provides
    fun providesDefaultDispatcher(): CoroutineDispatcher =
        AsyncTask.THREAD_POOL_EXECUTOR.asCoroutineDispatcher()

    @IoDispatcher
    @Provides
    fun providesIoDispatcher(): CoroutineDispatcher =
        AsyncTask.THREAD_POOL_EXECUTOR.asCoroutineDispatcher()

    @MainDispatcher
    @Provides
    fun providesMainDispatcher(): CoroutineDispatcher = Dispatchers.Main
}
```

Với mã code ở trên, chúng ta đang làm cho Hilt "quên" ```CoroutinesDispatchersModule``` được sử dụng trong production code trong các bài test. Module đó sẽ được thay thế bằng ```TestCoroutinesDispatchersModule``` sử dụng thread pool của ```Async Task``` cho công việc cần xảy ra ở nền, và ```Dispatchers.Main``` cho công việc cần xảy ra trên luồng chính mà Espresso cũng đang chờ.

Để biết thêm thông tin về kiểm thử, hãy xem [hướng dẫn kiểm thử của Hilt](https://developer.android.com/training/dependency-injection/hilt-testing).

Ví dụ của bài viết trên được áp dụng tại [đây](https://github.com/kendis1002/AN_realtime_location_flow_hilt) các bạn có thể tham khảo.



------

Trong bài viết này, bạn đã học cách tạo một CoroutineScope có phạm vi ứng dụng bằng cách sử dụng Hilt, tiêm nó như một phụ thuộc, tiêm các trường hợp khác nhau của CoroutineDispatcher, và thay thế các triển khai của chúng trong các bài kiểm tra.

