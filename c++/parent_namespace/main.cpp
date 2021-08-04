#include <iostream> 
#include "Util.hpp"
int main() {
  TestChild<int> tc(3);
  std::cout << tc.a << std::endl;
  return 0;
}
