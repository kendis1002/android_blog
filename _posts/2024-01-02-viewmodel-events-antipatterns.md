---
layout: post
current: post
cover: assets/images/viewmodelscope.png
navigation: True
title: Antipattern - ViewModel event 1 lần
date: 2023-12-08 10:18:00
tags: architecture
class: post-template
subclass: 'post'
author: kendis
---

Bạn nên xử lý ngay các event ViewModel bằng cách update UI state

ViewModel event là các hành động bắt nguồn từ ViewModel mà UI cần thực hiện. Chẳng hạn như hiển thị thông báo cho người dùng hoặc chuyển hướng đến một màn hình khác khi state ứng dụng thay đổi.

Hướng dẫn của Google về event ViewModel có hai quan điểm chính:
    - Bất cứ khi nào một event một lần xuất hiện trong ViewModel, ViewModel nên xử lý event đó ngay lập tức, tạo ra cập nhật state. ViewModel chỉ nên công khai state ứng dụng. Việc công khai các event chưa được rút gọn thành state từ ViewModel có nghĩa là ViewModel không phải là nsource of truth cho state được suy ra từ các event đó. [Unidirectional Data Flow](https://developer.android.com/jetpack/compose/architecture#udf) (UDF) mô tả những lợi thế của việc chỉ gửi event đến các object tiêu thụ tồn tại lâu hơn đối tượng tạo ra chúng.
    - State của ứng dụng nên được công khai thông qua một trình giữ dữ liệu có thể observable.

![Theo UDF (Unidirectional Data Flow - Luồng Dữ liệu Một Chiều), state chạy xuống từ ViewModel đến UI và event đi lên từ UI đến ViewModel.](assets/images/viewmodel-events-antipatterns-1.png "Theo UDF (Unidirectional Data Flow - Luồng Dữ liệu Một Chiều), state chạy xuống từ ViewModel đến UI và event đi lên từ UI đến ViewModel.")

Trong ứng dụng của bạn, bạn có thể đang sử dụng Kotlin Channels hoặc các reactive streams khác như SharedFlow để truyền event từ ViewModel đến UI, hoặc có thể bạn đã thấy mô hình này trong các dự án khác. Tuy nhiên, khi producer (ViewModel) tồn tại lâu hơn consumer (UI - Compose hoặc Views), như trường hợp của các event ViewModel, các API này **KHÔNG ĐẢM BẢO** việc gửi và xử lý các event đó. Điều này có thể dẫn đến lỗi và các vấn đề trong tương lai cho developer, đồng thời mang lại trải nghiệm người dùng không mong muốn cho hầu hết các ứng dụng.

> Bạn nên xử lý các event ViewModel ngay lập tức, bằng cách cập nhật UI state. Việc cố gắng công khai các event dưới dạng đối tượng bằng cách sử dụng các giải pháp reactive khác như Channel hoặc SharedFlow không đảm bảo việc gửi và xử lý các event đó.

## Case Study

Dưới đây là một ví dụ về việc triển khai ViewModel trong flow thanh toán điển hình của một ứng dụng. Trong đoạn code sau, ```MakePaymentViewModel``` trực tiếp yêu cầu UI điều hướng đến màn hình kết quả thanh toán khi kết quả của yêu cầu thanh toán được trả về. Chúng ta sẽ sử dụng ví dụ này để khám phá lý do tại sao việc xử lý các event một lần của ViewModel như thế này lại gây ra các vấn đề và chi phí kỹ thuật cao hơn.

```kotlin
class MakePaymentViewModel(...) : ViewModel() {

    val uiState: StateFlow<MakePaymentUiState> = /* ... */

    // ⚠️⚠️ DO NOT DO THIS!! ⚠️⚠️
    // This one-off ViewModel event hasn't been handled nor reduced to state
    // Boolean represents whether or not the payment was successful
    private val _navigateToPaymentResultScreen = Channel<Boolean>()

    // `receiveAsFlow` makes sure only one collector will process each
    // navigation event to avoid multiple back stack entries
    val navigateToPaymentResultScreen = _navigateToPaymentResultScreen.receiveAsFlow()

    // Protecting makePayment from concurrent callers
    // If a payment is in progress, don't trigger it again
    private var makePaymentJob: Job? = null

    fun makePayment() {
        if (makePaymentJob != null) return
        
        makePaymentJob = viewModelScope.launch {
            try {
                _uiState.update { it.copy(isLoading = true) } // Show loading spinner
                val isPaymentSuccessful = paymentsRepository.makePayment(...)
                _navigateToPaymentResultScreen.send(isPaymentSuccessful)
            } catch (ioe: IOException) { ... }
            finally { makePaymentJob = null }
        }
    }
}
```

UI sẽ nhận event này và di chuyển theo:

```kotlin
//////////////////////////////////////////////
// Jetpack Compose code
//////////////////////////////////////////////

@Composable
fun MakePaymentScreen(
    onPaymentMade: (Boolean) -> Unit,
    viewModel: MakePaymentViewModel = viewModel()
) {
    val currentOnPaymentMade by rememberUpdatedState(onPaymentMade)
    val lifecycle = LocalLifecycleOwner.current.lifecycle

    // Check whenever navigateToPaymentResultScreen emits a new value
    // to tell the caller composable the payment was made
    LaunchedEffect(viewModel, lifecycle)  {
        lifecycle.repeatOnLifecycle(state = STARTED) {
            viewModel.navigateToPaymentResultScreen.collect { isPaymentSuccessful ->
                currentOnPaymentMade(isPaymentSuccessful)
            }
        }
    }

    // Rest of the UI for the login screen.
}


//////////////////////////////////////////////
// Activity / Views code
//////////////////////////////////////////////

class MakePaymentActivity : AppCompatActivity() {
    private val viewModel: MakePaymentViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        /* ... */
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.navigateToPaymentResultScreen.collect { isPaymentSuccessful ->
                    val intent = Intent(this, PaymentResultActivity::class.java)
                    intent.putExtra("PAYMENT_RESULT", isPaymentSuccessful)
                    startActivity(intent)
                    finish()
                }
            }
        }
    }
}
```

Đoạn code thực hiện việc ```navigateToPaymentResultScreen``` trong ví dụ trên đó có một số lỗi thiết kế.

## Antipattern #1: Trạng thái về việc hoàn tất thanh toán có thể bị mất

Một Channel không đảm bảo việc phân phối và xử lý các event. Do đó, **các event có thể bị mất, dẫn đến UI ở trạng thái không nhất quán**. Ví dụ về điều này có thể xảy ra khi UI (người tiêu thụ) chuyển sang chế độ nền và dừng việc thu thập ```Channel``` ngay sau khi ``ViewModel`` (producer) gửi một event. Điều tương tự cũng có thể xảy ra với các API khác không phải là một loại trình giữ dữ liệu observable, chẳng hạn như ```SharedFlow```, có thể phát ra các event ngay cả khi không có consumer nào lắng nghe chúng.

Đây là một antipattern vì trạng thái kết quả thanh toán được mô hình hóa trong lớp UI **không bền vững** hoặc **không nguyên tử** nếu chúng ta nghĩ về nó theo thuật ngữ của một giao dịch **ACID**. Việc thanh toán có thể đã thành công theo như repository được biết, nhưng chúng ta chưa bao giờ được chuyển sang màn hình phù hợp tiếp theo.

Lưu ý: Antipattern này có thể được giảm thiểu bằng cách sử dụng Dispatchers.Main.immediate khi gửi và nhận các event. Tuy nhiên, nếu điều đó không được thực thi bởi lint, giải pháp này có thể dễ xảy ra lỗi vì các developer có thể dễ dàng quên nó.

## Antipattern #2: Bắt UI hành động

Đối với ứng dụng hỗ trợ nhiều kích thước màn hình, hành động UI cần thực hiện khi xảy ra ViewModel event có thể khác nhau tùy thuộc vào kích thước màn hình. Ví dụ: ứng dụng case study nên điều hướng đến màn hình kết quả thanh toán khi chạy trên điện thoại di động; nhưng nếu ứng dụng đang chạy trên máy tính bảng, hành động có thể hiển thị kết quả trong một phần khác của cùng một màn hình.

**ViewModel nên cho UI biết state ứng dụng là gì và UI nên xác định cách xử lý đối với state điều đó**. ViewModel không nên cho UI biết hành động nào cần thực hiện.

