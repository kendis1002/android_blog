---
layout: post
current: post
cover: assets/images/hilt-stable.png
navigation: True
title: Hilt đã stable. Đơn giản hoá việc dependency injection trong Android
date: 2023-12-24 10:18:00
tags: hilt
class: post-template
subclass: 'post'
author: kendis
---

Hilt, Giải pháp Dependency Injection của Jetpack cho Android app, giờ đã stable.

[Hilt](https://developer.android.com/training/dependency-injection/hilt-android), [Giải pháp Dependency Injection](https://developer.android.com/training/dependency-injection) của Jetpack cho Android app, đã chính thức **stable** và sẵn sàng để sử dụng trong môi trường **production**! Hilt hứa hẹn sự đơn giản, ít code thừa hơn Dagger, được thiết kế dành riêng cho Android và tích hợp liền mạch với nhiều thư viện Jetpack khác. Nhiều công ty đã bắt đầu áp dụng Hilt trong các ứng dụng của họ.

Kể từ khi được phát hành dưới dạng alpha vào tháng 6 năm 2020 với sứ mệnh thiết lập một phương thức DI tiêu chuẩn cho các ứng dụng Android, Hilt đã nhận được nhiều phản hồi từ các nhà phát triển. Điều này không chỉ giúp cải thiện thư viện mà còn cho thấy chúng ta đang đi đúng hướng trong việc giải quyết những vấn đề nan giải.

Thay vì tự tạo sơ đồ phụ thuộc, tiêm thủ công và truyền các kiểu qua lại, Hilt tự động tạo tất cả mã này cho bạn thông qua chú thích khi biên dịch. Hilt giúp bạn tận dụng tối đa các nguyên tắc hay của DI bằng cách xử lý những công việc phức tạp và tự động tạo mã boilerplate mà bạn vốn phải viết. Ngoài ra, với khả năng tích hợp hoàn toàn với Android, Hilt tự động quản lý vòng đời của các sơ đồ phụ thuộc liên quan đến các lớp framework Android.

Hãy cùng xem Hilt hoạt động như thế nào qua một ví dụ đơn giản! Sau khi [thiết lập Hilt](https://developer.android.com/training/dependency-injection/hilt-android#setup), sử dụng nó trong dự án mới để tiêm một ViewModel vào một Activity chỉ đơn giản bằng cách thêm một vài chú thích vào mã như sau:

```kotlin
@HiltAndroidApp // Setup Hilt in your app
class MyApplication : Application() { ... }

// Make Hilt aware of this ViewModel
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    /* ... Other dependencies Hilt takes care of ... */
) : ViewModel() { ... }


// Make the activity use the right ViewModel factory and
// inject other dependencies
@AndroidEntryPoint 
class LoginActivity : AppCompatActivity() {

    private val loginViewModel: LoginViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // loginViewModel is ready to be used
    }
}
```

Ngoài những lợi ích đã nêu ở trên, tại sao bạn nên sử dụng Hilt trong ứng dụng Android của mình?

## Đơn giản hơn Dagger

Hilt được xây dựng dựa trên Dagger, một thư viện tiêm phụ thuộc (DI) phổ biến, do đó thừa hưởng những ưu điểm như tính chính xác thời gian biên dịch, hiệu suất thời gian chạy, khả năng mở rộng và hỗ trợ Android Studio mà Dagger cung cấp. Một số chú thích của Dagger, ví dụ như @Inject để hướng dẫn Dagger và Hilt cách cung cấp một thực thể của một kiểu, vẫn được sử dụng thường xuyên trong Hilt. Tuy nhiên, Hilt đơn giản hơn Dagger!

> "Tôi rất khuyến khích sử dụng Dagger để thực hiện việc DI trong ứng dụng Android. Tuy nhiên, Dagger gốc có thể tạo ra quá nhiều không gian cho sự sáng tạo. Khi điều đó kết hợp với sự phức tạp của các thành phần nhận thức vòng đời khác nhau trong phát triển Android, có rất nhiều khả năng rơi vào các vấn đề như rò rỉ bộ nhớ: ví dụ, vô tình truyền các phụ thuộc có phạm vi hoạt động từ Activity vào ViewModels. Hilt, với tính chất có quan điểm cụ thể và được thiết kế đặc biệt cho Android, giúp bạn tránh một số rủi ro khi sử dụng Dagger gốc." — Marcelo Hernandez, Kỹ sư Phần mềm Cấp cao, Tinder

Nếu bạn đang sử dụng Dagger, bạn có thể hoàn toàn di chuyển từ Dagger sang Hilt theo từng phần trong ứng dụng Android của mình, Dagger và Hilt có thể tồn tại đồng thời trong ứng dụng, cho phép bạn tận hưởng những lợi ích của Hilt từng bước.

## Ít boilerplate code

Hilt có tính định hướng rõ ràng, tức là nó đưa ra những quyết định cho bạn để bạn không phải viết nhiều mã. Hilt xác định các thành phần tiêu chuẩn, hoặc sơ đồ phụ thuộc, được tích hợp hoàn toàn với các lớp framework Android như Application, Activity, Fragment và View. Ngoài ra, nó cũng cung cấp các scope annotation để xác định phạm vi của các thực thể đối với các thành phần đó.

> "Hilt tự động tạo ứng dụng kiểm thử và thành phần kiểm thử thông qua chú thích @HiltAndroidTest. Sau khi di chuyển sang Hilt, chúng tôi đã giảm được từ 20% đến 40% lượng mã boilerplate cần thiết để kết nối mã kiểm thử!" - Jusun Lee, Kỹ sư Phần mềm, YouTube

> "Chúng tôi chỉ mới bắt đầu trong việc di chuyển sang Hilt. Tuy nhiên, một trong những mô-đun đã được di chuyển, chúng tôi nhận thấy sự thay đổi +78/-182 dòng mã cho thư viện này." - Marcelo Hernandez, Kỹ sư Phần mềm Cấp cao, Tinder

## Tích hợp với các thư viện Jetpack khác


Bạn có thể sử dụng các thư viện Jetpack yêu thích của mình với Hilt ngay lập tức. Hiện tại, Android cung cấp hỗ trợ inject trực tiếp cho ViewModel, WorkManager, Navigation và Compose.

Để tìm hiểu thêm về sự hỗ trợ Jetpack, hãy tham khảo [tài liệu](https://developer.android.com/training/dependency-injection/hilt-jetpack).

> "Tôi thực sự đánh giá cao cách Hilt hoạt động ngay lập tức với ViewModel và cách nó loại bỏ mã boilerplate phải thiết lập ViewModel.Factory với Dagger thuần." — Marcelo Hernandez, Kỹ sư Phần mềm Cấp cao, Tinder

## Nguồn để tìm hiểu về Hilt

Hilt là giải pháp dependency injection (DI) được Jetpack đề xuất cho các ứng dụng Android. Bạn có thể tìm hiểu thêm về Hilt và bắt đầu sử dụng nó trong các ứng dụng của mình thông qua các tài liệu sau:

- Lợi ích của dependency injection: Tìm hiểu lý do tại sao nên sử dụng DI trong phát triển ứng dụng Android tại [đây](https://developer.android.com/training/dependency-injection).
- Tài liệu Hilt: Tham khảo [tài liệu chính thức](https://manuelvivo.dev/hilt-stable#:~:text=injection%20here.-,Documentation,-to%20learn%20how) để nắm được cách sử dụng Hilt trong ứng dụng của bạn.
- [Hướng dẫn chuyển đổi từ Dagger sang Hilt](https://dagger.dev/hilt/migration-guide): Nếu bạn đang sử dụng Dagger, tài liệu này sẽ hướng dẫn bạn cách chuyển sang Hilt từng bước.
- Codelabs học Hilt theo từng bước: [Hướng dẫn sử dụng Hilt trong ứng dụng Android](https://codelabs.developers.google.com/codelabs/android-hilt) và [Chuyển đổi từ Dagger sang Hilt](https://codelabs.developers.google.com/codelabs/android-dagger-to-hilt).
- Code sample: Xem Hilt hoạt động trong các ứng dụng thực tế như [Google I/O 2020](https://github.com/google/iosched) và [Sunflower](https://github.com/android/sunflower/).
- Cheat sheet: Tổng hợp nhanh các chú thích của Hilt và Dagger và cách sử dụng chúng.
